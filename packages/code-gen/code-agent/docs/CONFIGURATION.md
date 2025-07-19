# Git Integration Configuration Guide

This guide covers all configuration options available for the Git integration system.

## Table of Contents

1. [Basic Configuration](#basic-configuration)
2. [Repository Settings](#repository-settings)
3. [Branch Strategies](#branch-strategies)
4. [Commit Configuration](#commit-configuration)
5. [GitHub Integration](#github-integration)
6. [Error Handling](#error-handling)
7. [Performance Settings](#performance-settings)
8. [Environment Variables](#environment-variables)

## Basic Configuration

### Minimal Configuration

```javascript
const config = {
  enableGitIntegration: true,
  gitConfig: {
    enabled: true,
    user: {
      name: 'Your Name',
      email: 'your.email@example.com'
    }
  }
};
```

### Complete Configuration

```javascript
const config = {
  enableGitIntegration: true,
  gitConfig: {
    // Core settings
    enabled: true,
    repositoryStrategy: 'auto',
    branchStrategy: 'feature',
    commitStrategy: 'phase',
    pushStrategy: 'validation',
    
    // Repository settings
    organization: 'AgentResults',
    repositoryUrl: null,
    repositoryName: null,
    
    // User configuration
    user: {
      name: 'Code Agent',
      email: 'agent@codeagent.dev'
    },
    
    // Commit message settings
    commitMessage: {
      prefix: '[CodeAgent]',
      includePhase: true,
      includeTimestamp: false,
      includeSummary: true,
      maxLength: 72,
      format: 'conventional'
    },
    
    // GitHub settings
    github: {
      enabled: true,
      organization: 'AgentResults',
      createPullRequests: true,
      autoMerge: false,
      deleteSourceBranch: true
    },
    
    // Error handling
    errorRecovery: {
      enableAutoRecovery: true,
      maxRetryAttempts: 3,
      retryDelayMs: 1000,
      backoffMultiplier: 2
    },
    
    // Performance settings
    performance: {
      enableMetrics: true,
      enableCaching: true,
      rateLimiting: true,
      concurrentOperations: 3
    },
    
    // Advanced settings
    advanced: {
      enableTransactions: true,
      enableBackups: true,
      enableValidation: true,
      enableHooks: true
    }
  }
};
```

## Repository Settings

### Repository Strategy

Controls how the system handles repository initialization:

```javascript
{
  repositoryStrategy: 'auto' // 'new', 'existing', 'auto'
}
```

- **`new`**: Always create a new repository
- **`existing`**: Use existing repository (fails if none exists)
- **`auto`**: Automatically detect and choose appropriate strategy

### Repository Creation Options

```javascript
{
  repositoryCreation: {
    createRemote: true,        // Create GitHub repository
    private: false,            // Repository visibility
    autoLicense: true,         // Add license file
    licenseType: 'MIT',        // License type
    autoReadme: true,          // Generate README
    autoGitignore: true,       // Generate .gitignore
    gitignoreTemplate: 'Node', // Template for .gitignore
    description: 'Auto-generated repository',
    topics: ['code-agent', 'automation']
  }
}
```

### Repository URLs

```javascript
{
  repositoryUrl: 'https://github.com/AgentResults/my-repo.git',
  repositoryName: 'my-custom-repo', // Override default naming
  organization: 'AgentResults'       // GitHub organization
}
```

## Branch Strategies

### Available Strategies

```javascript
{
  branchStrategy: 'feature' // 'main', 'feature', 'timestamp', 'phase'
}
```

#### Main Strategy
Always work on the main branch:
```javascript
{
  branchStrategy: 'main',
  mainBranch: 'main' // or 'master'
}
```

#### Feature Strategy
Create feature branches for development:
```javascript
{
  branchStrategy: 'feature',
  featureBranching: {
    prefix: 'feature/',
    includePhase: true,
    includeTimestamp: false,
    maxLength: 50
  }
}
```

#### Timestamp Strategy
Create branches with timestamps:
```javascript
{
  branchStrategy: 'timestamp',
  timestampBranching: {
    prefix: 'dev/',
    format: 'YYYY-MM-DD-HH-mm-ss',
    timezone: 'UTC'
  }
}
```

#### Phase Strategy
Create branches for each development phase:
```javascript
{
  branchStrategy: 'phase',
  phaseBranching: {
    prefix: 'phase/',
    mergeToPrevious: true,
    autoCleanup: true
  }
}
```

### Branch Naming

```javascript
{
  branchNaming: {
    sanitize: true,           // Remove invalid characters
    maxLength: 50,            // Maximum branch name length
    replaceSpaces: '-',       // Replace spaces with dashes
    lowercase: true,          // Convert to lowercase
    removeEmoji: true         // Remove emoji characters
  }
}
```

## Commit Configuration

### Commit Strategy

```javascript
{
  commitStrategy: 'phase' // 'manual', 'phase', 'auto'
}
```

- **`manual`**: Only commit when explicitly requested
- **`phase`**: Automatically commit at phase boundaries
- **`auto`**: Automatically commit based on file changes

### Commit Message Configuration

```javascript
{
  commitMessage: {
    prefix: '[CodeAgent]',     // Commit message prefix
    includePhase: true,        // Include current phase
    includeTimestamp: false,   // Include timestamp
    includeSummary: true,      // Include change summary
    includeFileCount: false,   // Include number of files
    maxLength: 72,             // Maximum message length
    format: 'conventional',    // 'conventional', 'simple', 'detailed'
    emoji: false,              // Include emoji
    template: '{prefix} {phase}: {summary}'
  }
}
```

### Commit Message Formats

#### Conventional Format
```javascript
{
  commitMessage: {
    format: 'conventional',
    conventionalTypes: {
      feat: 'New features',
      fix: 'Bug fixes',
      docs: 'Documentation',
      style: 'Code style',
      refactor: 'Refactoring',
      test: 'Tests',
      chore: 'Maintenance'
    }
  }
}
```

#### Custom Template
```javascript
{
  commitMessage: {
    format: 'template',
    template: '{type}({scope}): {description}\n\n{body}\n\n{footer}',
    variables: {
      type: 'feat',
      scope: 'core',
      description: 'Generated by Code Agent',
      body: 'Detailed description of changes',
      footer: 'Closes #123'
    }
  }
}
```

### File Staging

```javascript
{
  staging: {
    autoStage: true,           // Automatically stage files
    ignorePatterns: [          // Files to ignore
      '*.log',
      'node_modules/',
      '.env'
    ],
    includeUntracked: true,    // Include untracked files
    maxFileSize: 10485760,     // Maximum file size (10MB)
    binaryFiles: false         // Include binary files
  }
}
```

## GitHub Integration

### Basic GitHub Settings

```javascript
{
  github: {
    enabled: true,
    organization: 'AgentResults',
    user: 'your-username',
    token: process.env.GITHUB_PAT // Set via environment variable
  }
}
```

### Pull Request Configuration

```javascript
{
  github: {
    pullRequests: {
      enabled: true,
      autoCreate: true,          // Create PRs automatically
      autoMerge: false,          // Auto-merge PRs
      deleteSourceBranch: true,  // Delete branch after merge
      draft: false,              // Create as draft
      template: {
        title: '{phase}: {summary}',
        body: `
## Summary
{description}

## Changes
{changes}

## Test Plan
{testPlan}

🤖 Generated with Code Agent
        `,
        assignees: ['code-agent'],
        reviewers: [],
        labels: ['code-agent', 'automated']
      }
    }
  }
}
```

### Repository Settings

```javascript
{
  github: {
    repository: {
      visibility: 'public',      // 'public', 'private'
      features: {
        issues: true,
        projects: false,
        wiki: false,
        pages: false
      },
      settings: {
        allowMergeCommit: true,
        allowSquashMerge: true,
        allowRebaseMerge: false,
        deleteBranchOnMerge: true
      }
    }
  }
}
```

### Rate Limiting

```javascript
{
  github: {
    rateLimiting: {
      enabled: true,
      requestsPerHour: 5000,     // GitHub API limit
      burstLimit: 100,           // Burst requests
      retryAfter: true,          // Respect retry-after header
      queueRequests: true        // Queue requests when rate limited
    }
  }
}
```

## Error Handling

### Automatic Recovery

```javascript
{
  errorRecovery: {
    enableAutoRecovery: true,
    maxRetryAttempts: 3,
    retryDelayMs: 1000,
    backoffMultiplier: 2,
    enabledErrorTypes: [
      'network',
      'rate-limit',
      'conflict',
      'authentication'
    ]
  }
}
```

### Error-Specific Settings

```javascript
{
  errorRecovery: {
    network: {
      maxRetries: 5,
      retryDelay: 2000,
      exponentialBackoff: true
    },
    authentication: {
      refreshToken: true,
      fallbackAuth: true
    },
    conflicts: {
      autoResolve: 'ours',      // 'ours', 'theirs', 'manual'
      backupBeforeResolve: true
    }
  }
}
```

### Logging and Debugging

```javascript
{
  logging: {
    level: 'info',              // 'debug', 'info', 'warn', 'error'
    enableFileLogging: false,
    logFilePath: './git-integration.log',
    includeTimestamp: true,
    includeStackTrace: true
  }
}
```

## Performance Settings

### Caching

```javascript
{
  performance: {
    caching: {
      enabled: true,
      ttl: 300000,              // 5 minutes
      maxSize: 100,             // Maximum cache entries
      types: [
        'repository-status',
        'branch-list',
        'commit-history',
        'github-api'
      ]
    }
  }
}
```

### Concurrency

```javascript
{
  performance: {
    concurrency: {
      maxConcurrentOperations: 3,
      gitOperationTimeout: 30000,    // 30 seconds
      githubApiTimeout: 10000,       // 10 seconds
      enableOperationQueue: true
    }
  }
}
```

### Metrics Collection

```javascript
{
  performance: {
    metrics: {
      enabled: true,
      collectInterval: 60000,        // 1 minute
      retentionPeriod: 3600000,      // 1 hour
      includeGitStats: true,
      includeGithubStats: true,
      includePerformanceStats: true
    }
  }
}
```

## Environment Variables

### Required Variables

```bash
# GitHub Personal Access Token
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxx

# GitHub organization (optional, defaults to AgentResults)
GITHUB_AGENT_ORG=AgentResults

# GitHub username
GITHUB_USER=your-username
```

### Optional Variables

```bash
# Git user configuration
GIT_USER_NAME="Code Agent"
GIT_USER_EMAIL="agent@codeagent.dev"

# Repository settings
GIT_DEFAULT_BRANCH=main
GIT_ORGANIZATION=AgentResults

# Performance settings
GIT_OPERATION_TIMEOUT=30000
GITHUB_API_TIMEOUT=10000
GIT_MAX_RETRIES=3

# Feature flags
ENABLE_GIT_INTEGRATION=true
ENABLE_GITHUB_INTEGRATION=true
ENABLE_AUTO_COMMIT=true
ENABLE_AUTO_PUSH=false

# Debug settings
GIT_DEBUG=false
GIT_VERBOSE=false
LOG_LEVEL=info
```

### Environment Variable Precedence

Configuration sources are applied in this order (later sources override earlier ones):

1. Default configuration
2. Environment variables
3. Configuration file
4. Constructor parameters
5. Runtime configuration changes

### Loading Configuration from File

```javascript
// Load from JSON file
const config = require('./git-config.json');

// Load from YAML file
const yaml = require('yaml');
const fs = require('fs');
const config = yaml.parse(fs.readFileSync('./git-config.yaml', 'utf8'));

// Use with CodeAgent
const agent = new CodeAgent({
  enableGitIntegration: true,
  gitConfig: config
});
```

### Configuration Validation

```javascript
import { GitConfigValidator } from '@jsenvoy/code-agent';

// Validate configuration
const validation = GitConfigValidator.validateConfig(config);
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}

// Merge with defaults
const mergedConfig = GitConfigValidator.mergeWithDefaults(config);
```

## Advanced Configuration

### Custom Branch Strategies

```javascript
{
  branchStrategy: 'custom',
  customBranchStrategy: {
    generateName: (phase, options) => {
      return `custom-${phase}-${Date.now()}`;
    },
    shouldCreateBranch: (phase, currentBranch) => {
      return phase !== 'planning';
    },
    mergeStrategy: 'squash'
  }
}
```

### Custom Commit Message Generation

```javascript
{
  commitMessage: {
    format: 'custom',
    generator: (files, phase, metadata) => {
      const fileCount = files.length;
      const changes = analyzeChanges(files);
      return `${phase}: ${changes.summary} (${fileCount} files)`;
    }
  }
}
```

### Hooks and Events

```javascript
{
  hooks: {
    beforeCommit: async (files, message) => {
      // Custom validation before commit
      return { valid: true, message };
    },
    afterCommit: async (commitHash, files) => {
      // Custom actions after commit
      console.log('Committed:', commitHash);
    },
    beforePush: async (branch, commits) => {
      // Custom validation before push
      return { allowed: true };
    },
    afterPush: async (branch, result) => {
      // Custom actions after push
      console.log('Pushed to:', branch);
    }
  }
}
```

## Configuration Examples

### Development Environment

```javascript
const developmentConfig = {
  enableGitIntegration: true,
  gitConfig: {
    enabled: true,
    repositoryStrategy: 'auto',
    branchStrategy: 'feature',
    commitStrategy: 'auto',
    pushStrategy: 'never',
    errorRecovery: {
      enableAutoRecovery: true,
      maxRetryAttempts: 1
    },
    logging: {
      level: 'debug'
    }
  }
};
```

### Production Environment

```javascript
const productionConfig = {
  enableGitIntegration: true,
  gitConfig: {
    enabled: true,
    repositoryStrategy: 'existing',
    branchStrategy: 'phase',
    commitStrategy: 'phase',
    pushStrategy: 'validation',
    errorRecovery: {
      enableAutoRecovery: true,
      maxRetryAttempts: 5
    },
    performance: {
      enableMetrics: true,
      enableCaching: true
    },
    logging: {
      level: 'warn'
    }
  }
};
```

### CI/CD Environment

```javascript
const ciConfig = {
  enableGitIntegration: true,
  gitConfig: {
    enabled: true,
    repositoryStrategy: 'existing',
    branchStrategy: 'timestamp',
    commitStrategy: 'manual',
    pushStrategy: 'always',
    github: {
      pullRequests: {
        enabled: true,
        autoCreate: true,
        draft: true
      }
    }
  }
};
```

## See Also

- [Basic Usage Examples](./examples/basic-usage.md)
- [Advanced Usage Examples](./examples/advanced-usage.md)
- [API Documentation](./api/)
- [Troubleshooting Guide](./troubleshooting.md)