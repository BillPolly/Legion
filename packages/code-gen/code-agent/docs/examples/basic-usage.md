# Basic Usage Examples

This guide provides practical examples of using the Git integration in common development scenarios.

## Table of Contents

1. [Basic Setup](#basic-setup)
2. [New Repository Creation](#new-repository-creation)
3. [Existing Repository Integration](#existing-repository-integration)
4. [Basic Development Workflow](#basic-development-workflow)
5. [Phase-Based Development](#phase-based-development)
6. [Error Handling](#error-handling)

## Basic Setup

### Setting Up a Code Agent with Git Integration

```javascript
import { ResourceManager } from '@jsenvoy/module-loader';
import { CodeAgent } from '@jsenvoy/code-agent';

// Initialize resource manager
const resourceManager = new ResourceManager();
await resourceManager.initialize();

// Register required environment variables
resourceManager.register('GITHUB_PAT', process.env.GITHUB_PAT);
resourceManager.register('GITHUB_AGENT_ORG', 'AgentResults');
resourceManager.register('GITHUB_USER', 'your-username');

// Configure code agent with Git integration
const config = {
  enableGitIntegration: true,
  gitConfig: {
    enabled: true,
    repositoryStrategy: 'new',
    branchStrategy: 'feature',
    commitStrategy: 'phase',
    pushStrategy: 'validation',
    user: {
      name: 'Code Agent',
      email: 'agent@codeagent.dev'
    }
  }
};

// Create and initialize agent
const agent = new CodeAgent(config);
await agent.initialize('/path/to/project');
```

### Minimal Configuration

```javascript
// Simplest possible configuration
const agent = new CodeAgent({
  enableGitIntegration: true,
  gitConfig: {
    enabled: true,
    user: {
      name: 'Your Name',
      email: 'your.email@example.com'
    }
  }
});

await agent.initialize('/path/to/project');
```

## New Repository Creation

### Creating a New Repository

```javascript
// Configure for new repository creation
const config = {
  enableGitIntegration: true,
  gitConfig: {
    enabled: true,
    repositoryStrategy: 'new',
    organization: 'AgentResults',
    user: {
      name: 'Code Agent',
      email: 'agent@codeagent.dev'
    }
  }
};

const agent = new CodeAgent(config);
await agent.initialize('/path/to/new/project');

// Initialize Git repository
const initResult = await agent.initializeGitRepository();
console.log('Repository created:', initResult.repositoryUrl);
console.log('Local path:', initResult.localPath);
```

### Creating Repository with Custom Settings

```javascript
const initResult = await agent.initializeGitRepository({
  createRemote: true,
  repositoryName: 'my-custom-project',
  description: 'A custom project created by Code Agent',
  private: false,
  autoLicense: true,
  licenseType: 'MIT'
});

console.log('Repository URL:', initResult.repositoryUrl);
console.log('Clone URL:', initResult.cloneUrl);
```

## Existing Repository Integration

### Working with Existing Repository

```javascript
// Configure for existing repository
const config = {
  enableGitIntegration: true,
  gitConfig: {
    enabled: true,
    repositoryStrategy: 'existing',
    repositoryUrl: 'https://github.com/AgentResults/existing-project.git'
  }
};

const agent = new CodeAgent(config);
await agent.initialize('/path/to/existing/project');

// The agent will automatically detect and integrate with the existing repo
const status = await agent.getGitStatus();
console.log('Current branch:', status.currentBranch);
console.log('Commits:', status.commits);
```

### Auto-Detection Mode

```javascript
// Let the agent automatically detect repository strategy
const config = {
  enableGitIntegration: true,
  gitConfig: {
    enabled: true,
    repositoryStrategy: 'auto', // Auto-detect new vs existing
    organization: 'AgentResults'
  }
};

const agent = new CodeAgent(config);
await agent.initialize('/path/to/project');

// Agent will create new repo if none exists, or use existing one
const status = await agent.getGitStatus();
console.log('Repository strategy used:', status.strategy);
```

## Basic Development Workflow

### Simple File Commit Workflow

```javascript
// Create some files
await fs.writeFile('/path/to/project/src/index.js', `
console.log('Hello, World!');
`);

await fs.writeFile('/path/to/project/package.json', JSON.stringify({
  name: 'my-project',
  version: '1.0.0',
  main: 'src/index.js'
}, null, 2));

// Track and commit files
await agent.trackFile('src/index.js');
await agent.trackFile('package.json');

const commitResult = await agent.commitFiles(
  ['src/index.js', 'package.json'],
  'Initial project setup'
);

console.log('Commit hash:', commitResult.commitHash);
console.log('Files committed:', commitResult.filesCommitted);
```

### Branch Management

```javascript
// Create a new feature branch
const branchResult = await agent.createBranch('feature/user-authentication');
console.log('Branch created:', branchResult.branchName);

// Switch between branches
await agent.switchBranch('main');
await agent.switchBranch('feature/user-authentication');

// List all branches
const branches = await agent.listBranches();
console.log('Available branches:', branches);
```

### Pushing Changes

```javascript
// Push current branch to remote
const pushResult = await agent.pushToRemote();
console.log('Push successful:', pushResult.success);
console.log('Remote URL:', pushResult.remoteUrl);

// Push with upstream tracking
const pushWithUpstream = await agent.pushToRemote('feature/new-feature', {
  setUpstream: true
});
```

## Phase-Based Development

### Using Phase-Based Workflow

```javascript
// Configure for phase-based development
const config = {
  enableGitIntegration: true,
  gitConfig: {
    enabled: true,
    branchStrategy: 'phase',
    commitStrategy: 'phase',
    commitMessage: {
      includePhase: true,
      includeSummary: true
    }
  }
};

const agent = new CodeAgent(config);
await agent.initialize('/path/to/project');

// Start planning phase
await agent.startPhase('planning');

// Create planning files
await fs.writeFile('/path/to/project/PLAN.md', `
# Project Plan
- Planning phase
- Generation phase
- Testing phase
- Quality phase
`);

await agent.trackFile('PLAN.md');
await agent.completePhase('planning');

// Start generation phase
await agent.startPhase('generation');

// Generate code files
await fs.writeFile('/path/to/project/src/app.js', `
// Generated application code
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

module.exports = app;
`);

await agent.trackFile('src/app.js');
await agent.completePhase('generation');
```

### Phase Metadata and Metrics

```javascript
// Get phase-specific metrics
const metrics = await agent.getGitMetrics();
console.log('Commits by phase:', metrics.commitsByPhase);

// Example output:
// {
//   planning: 1,
//   generation: 1,
//   testing: 0,
//   quality: 0
// }

// Start phase with metadata
await agent.startPhase('testing', {
  testFramework: 'jest',
  coverageTarget: 90
});
```

## Error Handling

### Basic Error Handling

```javascript
try {
  await agent.commitFiles(['nonexistent-file.js'], 'This will fail');
} catch (error) {
  if (error.name === 'GitError') {
    console.log('Git operation failed:', error.message);
    console.log('Error type:', error.type);
    
    // Get recovery suggestions
    if (error.recovery) {
      console.log('Recovery suggestion:', error.recovery);
    }
  }
}
```

### Listening for Error Recovery Events

```javascript
// Listen for automatic error recovery
agent.on('error-recovered', (data) => {
  console.log('Automatically recovered from error:', data.errorType);
  console.log('Recovery strategy used:', data.strategy);
  console.log('Operation continued successfully');
});

// Listen for errors that couldn't be recovered
agent.on('error-failed', (data) => {
  console.log('Failed to recover from error:', data.errorType);
  console.log('Manual intervention required');
});
```

### Handling Network Issues

```javascript
// Configure retry behavior for network issues
const config = {
  enableGitIntegration: true,
  gitConfig: {
    enabled: true,
    errorRecovery: {
      enableAutoRecovery: true,
      maxRetryAttempts: 3,
      retryDelayMs: 1000,
      enableNetworkRetry: true
    }
  }
};

const agent = new CodeAgent(config);

// Network errors will be automatically retried
try {
  await agent.pushToRemote();
} catch (error) {
  console.log('Push failed after retries:', error.message);
}
```

## Monitoring and Debugging

### Getting Repository Status

```javascript
// Get comprehensive status
const status = await agent.getGitStatus();
console.log('Repository status:', {
  initialized: status.initialized,
  currentBranch: status.currentBranch,
  commits: status.commits,
  trackedFiles: status.trackedFiles.length,
  pendingChanges: status.pendingChanges.length,
  remoteUrl: status.remoteUrl
});
```

### Metrics and Analytics

```javascript
// Get detailed metrics
const metrics = await agent.getGitMetrics();
console.log('Git metrics:', {
  totalCommits: metrics.totalCommits,
  totalBranches: metrics.branchesCreated,
  averageCommitSize: metrics.averageCommitSize,
  mostActivePhase: metrics.mostActivePhase,
  githubApiCalls: metrics.githubOperations
});
```

### Debug Mode

```javascript
// Enable debug logging
const config = {
  enableGitIntegration: true,
  gitConfig: {
    enabled: true,
    debug: true,
    verbose: true
  }
};

// This will log detailed information about all Git operations
const agent = new CodeAgent(config);
```

## Complete Example

Here's a complete example that demonstrates a full development workflow:

```javascript
import { ResourceManager } from '@jsenvoy/module-loader';
import { CodeAgent } from '@jsenvoy/code-agent';
import { promises as fs } from 'fs';
import path from 'path';

async function completeWorkflowExample() {
  // Setup
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  resourceManager.register('GITHUB_PAT', process.env.GITHUB_PAT);
  resourceManager.register('GITHUB_AGENT_ORG', 'AgentResults');
  resourceManager.register('GITHUB_USER', 'code-agent');

  const config = {
    enableGitIntegration: true,
    gitConfig: {
      enabled: true,
      repositoryStrategy: 'new',
      branchStrategy: 'phase',
      commitStrategy: 'phase',
      pushStrategy: 'validation',
      user: {
        name: 'Code Agent',
        email: 'agent@codeagent.dev'
      }
    }
  };

  const agent = new CodeAgent(config);
  const projectPath = '/tmp/example-project';
  
  try {
    // Initialize project
    await agent.initialize(projectPath);
    const initResult = await agent.initializeGitRepository();
    console.log('✅ Repository created:', initResult.repositoryUrl);

    // Planning phase
    await agent.startPhase('planning');
    await fs.writeFile(path.join(projectPath, 'README.md'), `
# Example Project

This is an example project created by Code Agent.

## Features
- Node.js application
- Express server
- Basic routing
    `);
    
    await agent.trackFile('README.md');
    await agent.completePhase('planning');
    console.log('✅ Planning phase completed');

    // Generation phase
    await agent.startPhase('generation');
    
    await fs.writeFile(path.join(projectPath, 'package.json'), JSON.stringify({
      name: 'example-project',
      version: '1.0.0',
      description: 'Example project created by Code Agent',
      main: 'src/index.js',
      scripts: {
        start: 'node src/index.js',
        test: 'jest'
      },
      dependencies: {
        express: '^4.18.0'
      },
      devDependencies: {
        jest: '^29.0.0'
      }
    }, null, 2));

    await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
    await fs.writeFile(path.join(projectPath, 'src/index.js'), `
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Code Agent!' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
    `);

    await agent.trackFile('package.json');
    await agent.trackFile('src/index.js');
    await agent.completePhase('generation');
    console.log('✅ Generation phase completed');

    // Testing phase
    await agent.startPhase('testing');
    
    await fs.mkdir(path.join(projectPath, '__tests__'), { recursive: true });
    await fs.writeFile(path.join(projectPath, '__tests__/index.test.js'), `
const request = require('supertest');
const app = require('../src/index');

describe('GET /', () => {
  it('should return hello message', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Hello from Code Agent!');
  });
});
    `);

    await agent.trackFile('__tests__/index.test.js');
    await agent.completePhase('testing');
    console.log('✅ Testing phase completed');

    // Push all changes
    const pushResult = await agent.pushToRemote();
    if (pushResult.success) {
      console.log('✅ Changes pushed to remote repository');
    }

    // Get final metrics
    const metrics = await agent.getGitMetrics();
    console.log('📊 Final metrics:', {
      totalCommits: metrics.totalCommits,
      commitsByPhase: metrics.commitsByPhase,
      filesTracked: metrics.totalFilesTracked
    });

  } catch (error) {
    console.error('❌ Error in workflow:', error.message);
  } finally {
    await agent.cleanup();
  }
}

// Run the example
completeWorkflowExample().catch(console.error);
```

This example demonstrates:
- Complete project setup with Git integration
- Phase-based development workflow
- File creation and tracking
- Automatic commit generation
- Push to remote repository
- Metrics collection
- Proper cleanup

## Next Steps

- [Advanced Configuration](../configuration.md)
- [Branch Strategies](../guides/branch-strategies.md)
- [Error Recovery](../guides/error-recovery.md)
- [Performance Optimization](../guides/performance.md)