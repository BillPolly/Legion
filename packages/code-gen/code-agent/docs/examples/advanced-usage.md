# Advanced Usage Examples

This guide demonstrates advanced Git integration patterns and sophisticated usage scenarios.

## Table of Contents

1. [Custom Branch Strategies](#custom-branch-strategies)
2. [Advanced Commit Orchestration](#advanced-commit-orchestration)
3. [Error Recovery and Resilience](#error-recovery-and-resilience)
4. [Performance Optimization](#performance-optimization)
5. [Multi-Repository Management](#multi-repository-management)
6. [CI/CD Integration](#ci-cd-integration)
7. [Custom Hooks and Extensions](#custom-hooks-and-extensions)

## Custom Branch Strategies

### Implementing a Custom Branch Strategy

```javascript
import { BranchManager } from '@jsenvoy/code-agent';

class CustomBranchStrategy {
  constructor(config) {
    this.config = config;
    this.projectPrefix = config.projectPrefix || 'project';
  }

  generateBranchName(phase, metadata = {}) {
    const timestamp = new Date().toISOString().slice(0, 10);
    const feature = metadata.feature || 'unknown';
    const complexity = metadata.complexity || 'medium';
    
    return `${this.projectPrefix}/${phase}/${feature}-${complexity}-${timestamp}`;
  }

  shouldCreateBranch(currentPhase, targetPhase, currentBranch) {
    // Don't create branches for documentation phase
    if (targetPhase === 'documentation') return false;
    
    // Always create branch for generation and testing phases
    if (['generation', 'testing'].includes(targetPhase)) return true;
    
    // Create branch if complexity is high
    return this.config.complexity === 'high';
  }

  getMergeStrategy(sourceBranch, targetBranch) {
    if (sourceBranch.includes('hotfix')) return 'squash';
    if (sourceBranch.includes('feature')) return 'merge';
    return 'rebase';
  }
}

// Use custom strategy
const branchManager = new BranchManager(repositoryManager, {
  strategy: new CustomBranchStrategy({
    projectPrefix: 'myproject',
    complexity: 'high'
  })
});

// Create branch with metadata
const branchResult = await branchManager.createBranch('generation', {
  feature: 'user-auth',
  complexity: 'high',
  priority: 'critical'
});

console.log('Created branch:', branchResult.branchName);
// Output: myproject/generation/user-auth-high-2024-01-15
```

### Dynamic Branch Strategy Selection

```javascript
class AdaptiveBranchStrategy {
  constructor(strategies) {
    this.strategies = strategies;
  }

  selectStrategy(context) {
    const { phase, fileCount, complexity, teamSize } = context;
    
    // Use timestamp strategy for rapid prototyping
    if (phase === 'prototyping' || fileCount < 5) {
      return this.strategies.timestamp;
    }
    
    // Use feature strategy for complex features
    if (complexity === 'high' || teamSize > 1) {
      return this.strategies.feature;
    }
    
    // Use phase strategy for structured development
    return this.strategies.phase;
  }

  async createBranch(phase, metadata) {
    const strategy = this.selectStrategy({ phase, ...metadata });
    return await strategy.createBranch(phase, metadata);
  }
}

// Configure adaptive strategy
const adaptiveStrategy = new AdaptiveBranchStrategy({
  timestamp: new TimestampBranchStrategy(),
  feature: new FeatureBranchStrategy(),
  phase: new PhaseBranchStrategy()
});

const branchManager = new BranchManager(repositoryManager, {
  strategy: adaptiveStrategy
});
```

## Advanced Commit Orchestration

### Intelligent Commit Grouping

```javascript
import { CommitOrchestrator, ChangeTracker } from '@jsenvoy/code-agent';

class IntelligentCommitOrchestrator extends CommitOrchestrator {
  constructor(repositoryManager, config) {
    super(repositoryManager, config);
    this.changeTracker = new ChangeTracker(config);
  }

  async createIntelligentCommits(files, options = {}) {
    // Analyze changes to group logically related files
    const changes = await this.changeTracker.analyzeChanges(files);
    const groups = this.groupChangesByLogic(changes);
    
    const commits = [];
    
    for (const group of groups) {
      const commitMessage = await this.generateContextualMessage(group);
      
      const commitResult = await this.createCommit(group.files, commitMessage, {
        ...options,
        metadata: {
          changeType: group.type,
          impact: group.impact,
          relatedFiles: group.relatedFiles
        }
      });
      
      commits.push(commitResult);
    }
    
    return commits;
  }

  groupChangesByLogic(changes) {
    const groups = [];
    const processed = new Set();
    
    for (const change of changes) {
      if (processed.has(change.file)) continue;
      
      const group = {
        type: change.category,
        impact: change.impact,
        files: [change.file],
        relatedFiles: []
      };
      
      // Find related changes
      for (const otherChange of changes) {
        if (processed.has(otherChange.file)) continue;
        
        if (this.areRelated(change, otherChange)) {
          group.files.push(otherChange.file);
          group.relatedFiles.push(otherChange.file);
          processed.add(otherChange.file);
        }
      }
      
      processed.add(change.file);
      groups.push(group);
    }
    
    return groups;
  }

  areRelated(change1, change2) {
    // Files in same directory
    if (path.dirname(change1.file) === path.dirname(change2.file)) {
      return true;
    }
    
    // Same category and similar names
    if (change1.category === change2.category &&
        this.calculateSimilarity(change1.file, change2.file) > 0.7) {
      return true;
    }
    
    // Import/export relationships
    if (change1.imports?.includes(change2.file) ||
        change2.imports?.includes(change1.file)) {
      return true;
    }
    
    return false;
  }

  async generateContextualMessage(group) {
    const { type, impact, files } = group;
    const fileCount = files.length;
    
    let prefix = '';
    switch (type) {
      case 'feature': prefix = 'feat'; break;
      case 'bugfix': prefix = 'fix'; break;
      case 'test': prefix = 'test'; break;
      case 'docs': prefix = 'docs'; break;
      default: prefix = 'chore'; break;
    }
    
    const scope = this.determineScope(files);
    const description = await this.generateDescription(group);
    
    let message = `${prefix}`;
    if (scope) message += `(${scope})`;
    message += `: ${description}`;
    
    if (fileCount > 1) {
      message += ` (${fileCount} files)`;
    }
    
    if (impact === 'breaking') {
      message += '\n\nBREAKING CHANGE: ' + await this.analyzeBreakingChange(group);
    }
    
    return message;
  }
}

// Usage
const orchestrator = new IntelligentCommitOrchestrator(repositoryManager, {
  generateMessages: true,
  messageFormat: 'conventional',
  groupRelatedChanges: true
});

const files = [
  'src/auth/login.js',
  'src/auth/login.test.js',
  'src/auth/register.js',
  'src/auth/register.test.js',
  'src/utils/validation.js',
  'docs/auth.md'
];

const commits = await orchestrator.createIntelligentCommits(files, {
  phase: 'generation'
});

console.log(`Created ${commits.length} logical commits`);
```

### Semantic Release Integration

```javascript
class SemanticReleaseCommitOrchestrator extends CommitOrchestrator {
  constructor(repositoryManager, config) {
    super(repositoryManager, config);
    this.semanticConfig = config.semanticRelease || {};
  }

  async createSemanticCommit(files, changeType, description, options = {}) {
    const { breaking = false, issues = [], scope } = options;
    
    // Generate semantic commit message
    let message = changeType;
    if (scope) message += `(${scope})`;
    if (breaking) message += '!';
    message += `: ${description}`;
    
    // Add body if needed
    if (options.body) {
      message += '\n\n' + options.body;
    }
    
    // Add breaking change footer
    if (breaking && options.breakingChange) {
      message += '\n\nBREAKING CHANGE: ' + options.breakingChange;
    }
    
    // Add issue references
    if (issues.length > 0) {
      message += '\n\n' + issues.map(issue => `Closes #${issue}`).join('\n');
    }
    
    return await this.createCommit(files, message, {
      ...options,
      metadata: {
        semanticType: changeType,
        breaking,
        scope,
        issues
      }
    });
  }

  async analyzeChangesForSemantic(files) {
    const changes = await this.changeTracker.analyzeChanges(files);
    
    // Determine semantic type based on changes
    let semanticType = 'chore';
    let breaking = false;
    
    for (const change of changes) {
      if (change.category === 'feature') {
        semanticType = 'feat';
      } else if (change.category === 'bugfix') {
        semanticType = 'fix';
      } else if (change.category === 'test') {
        semanticType = 'test';
      }
      
      if (change.breaking) {
        breaking = true;
      }
    }
    
    return { semanticType, breaking, changes };
  }
}

// Usage
const semanticOrchestrator = new SemanticReleaseCommitOrchestrator(repositoryManager, {
  semanticRelease: {
    preset: 'conventional',
    releaseRules: [
      { type: 'feat', release: 'minor' },
      { type: 'fix', release: 'patch' },
      { type: 'perf', release: 'patch' }
    ]
  }
});

// Create semantic commits
await semanticOrchestrator.createSemanticCommit(
  ['src/api/users.js'],
  'feat',
  'add user profile endpoint',
  {
    scope: 'api',
    body: 'Add new endpoint for retrieving user profiles with pagination support',
    issues: [123, 124]
  }
);

await semanticOrchestrator.createSemanticCommit(
  ['src/auth/session.js'],
  'fix',
  'resolve session timeout issue',
  {
    scope: 'auth',
    breaking: true,
    breakingChange: 'Session timeout is now configurable and defaults to 1 hour'
  }
);
```

## Error Recovery and Resilience

### Advanced Error Recovery Strategies

```javascript
import { GitErrorHandler, RepositoryRecovery } from '@jsenvoy/code-agent';

class AdvancedErrorRecovery {
  constructor(config) {
    this.errorHandler = new GitErrorHandler(config.errorHandling);
    this.repositoryRecovery = new RepositoryRecovery(config.recovery);
    this.retryStrategies = new Map();
    
    this.setupRetryStrategies();
  }

  setupRetryStrategies() {
    // Exponential backoff for network errors
    this.retryStrategies.set('network', {
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      jitter: true
    });
    
    // Linear backoff for rate limiting
    this.retryStrategies.set('rateLimit', {
      maxAttempts: 10,
      baseDelay: 60000, // 1 minute
      maxDelay: 600000, // 10 minutes
      backoffFactor: 1,
      respectRetryAfter: true
    });
    
    // Immediate retry for temporary conflicts
    this.retryStrategies.set('conflict', {
      maxAttempts: 3,
      baseDelay: 0,
      maxDelay: 5000,
      backoffFactor: 1.5,
      conflictResolution: 'auto'
    });
  }

  async executeWithRecovery(operation, operationType, context = {}) {
    const strategy = this.retryStrategies.get(operationType) || {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2
    };
    
    let lastError = null;
    let attempt = 0;
    
    while (attempt < strategy.maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        attempt++;
        
        // Classify error and determine if retryable
        const errorInfo = await this.errorHandler.classifyError(error, context);
        
        if (!errorInfo.recoverable || attempt >= strategy.maxAttempts) {
          throw error;
        }
        
        // Attempt error-specific recovery
        const recoveryResult = await this.errorHandler.attemptRecovery(errorInfo, context);
        
        if (recoveryResult.success) {
          console.log(`✅ Recovered from ${errorInfo.classification} error`);
          continue; // Retry the operation
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, strategy);
        
        console.log(`⏳ Retrying in ${delay}ms (attempt ${attempt}/${strategy.maxAttempts})`);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  calculateDelay(attempt, strategy) {
    let delay = strategy.baseDelay * Math.pow(strategy.backoffFactor, attempt - 1);
    
    // Apply jitter to prevent thundering herd
    if (strategy.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.min(delay, strategy.maxDelay);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage with Git operations
const errorRecovery = new AdvancedErrorRecovery({
  errorHandling: {
    enableAutoRecovery: true,
    maxRetryAttempts: 5
  },
  recovery: {
    enableAutoBackup: true,
    enableCorruptionCheck: true
  }
});

// Resilient push operation
async function resilientPush(gitManager, branch) {
  return await errorRecovery.executeWithRecovery(
    () => gitManager.pushToRemote(branch),
    'network',
    {
      branch,
      operation: 'push',
      fallbackBranch: 'main'
    }
  );
}

// Resilient commit operation
async function resilientCommit(gitManager, files, message) {
  return await errorRecovery.executeWithRecovery(
    () => gitManager.commitFiles(files, message),
    'conflict',
    {
      files,
      message,
      autoStage: true,
      conflictResolution: 'ours'
    }
  );
}
```

### Repository Health Monitoring

```javascript
class RepositoryHealthMonitor {
  constructor(repositoryRecovery, config = {}) {
    this.recovery = repositoryRecovery;
    this.config = {
      checkInterval: config.checkInterval || 300000, // 5 minutes
      alertThreshold: config.alertThreshold || 'warning',
      autoRepair: config.autoRepair !== false,
      enableNotifications: config.enableNotifications !== false
    };
    
    this.healthHistory = [];
    this.monitoringInterval = null;
  }

  startMonitoring() {
    if (this.monitoringInterval) {
      return;
    }
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Health check failed:', error.message);
      }
    }, this.config.checkInterval);
    
    console.log('🏥 Repository health monitoring started');
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('🏥 Repository health monitoring stopped');
  }

  async performHealthCheck() {
    const healthReport = await this.recovery.performHealthCheck();
    
    // Store health history
    this.healthHistory.push({
      timestamp: new Date(),
      overall: healthReport.overall,
      issueCount: healthReport.issues.length,
      issues: healthReport.issues.map(i => ({ check: i.check, severity: i.severity }))
    });
    
    // Trim history to last 100 entries
    if (this.healthHistory.length > 100) {
      this.healthHistory = this.healthHistory.slice(-100);
    }
    
    // Check if action is needed
    if (this.shouldTakeAction(healthReport)) {
      await this.handleHealthIssues(healthReport);
    }
    
    return healthReport;
  }

  shouldTakeAction(healthReport) {
    const { overall, issues } = healthReport;
    
    if (overall === 'critical') return true;
    
    if (overall === 'warning' && this.config.alertThreshold === 'warning') {
      return true;
    }
    
    // Check for recurring issues
    const recentIssues = this.healthHistory.slice(-5);
    if (recentIssues.length >= 5 && recentIssues.every(h => h.issueCount > 0)) {
      return true;
    }
    
    return false;
  }

  async handleHealthIssues(healthReport) {
    const { issues, overall } = healthReport;
    
    console.log(`🚨 Repository health issues detected (${overall})`);
    
    if (this.config.autoRepair && overall === 'critical') {
      console.log('🔧 Attempting automatic repair...');
      
      const repairResult = await this.recovery.repairRepository(issues);
      
      if (repairResult.success) {
        console.log('✅ Automatic repair completed successfully');
        
        if (this.config.enableNotifications) {
          await this.sendNotification('repair-success', {
            issues: issues.length,
            repaired: repairResult.repairsSuccessful
          });
        }
      } else {
        console.log('❌ Automatic repair failed');
        
        if (this.config.enableNotifications) {
          await this.sendNotification('repair-failed', {
            issues: issues.length,
            errors: repairResult.repairsFailed
          });
        }
      }
    }
    
    if (this.config.enableNotifications) {
      await this.sendNotification('health-alert', {
        overall,
        issues: issues.length,
        details: issues
      });
    }
  }

  async sendNotification(type, data) {
    // Implement notification logic (email, Slack, etc.)
    console.log(`📧 Notification: ${type}`, data);
  }

  getHealthTrends() {
    if (this.healthHistory.length < 2) {
      return { trend: 'insufficient-data' };
    }
    
    const recent = this.healthHistory.slice(-10);
    const avgIssues = recent.reduce((sum, h) => sum + h.issueCount, 0) / recent.length;
    
    const older = this.healthHistory.slice(-20, -10);
    const oldAvgIssues = older.length > 0 
      ? older.reduce((sum, h) => sum + h.issueCount, 0) / older.length 
      : avgIssues;
    
    let trend = 'stable';
    if (avgIssues > oldAvgIssues * 1.2) {
      trend = 'degrading';
    } else if (avgIssues < oldAvgIssues * 0.8) {
      trend = 'improving';
    }
    
    return {
      trend,
      currentAverage: avgIssues,
      previousAverage: oldAvgIssues,
      totalChecks: this.healthHistory.length
    };
  }
}

// Usage
const healthMonitor = new RepositoryHealthMonitor(repositoryRecovery, {
  checkInterval: 180000, // 3 minutes
  alertThreshold: 'warning',
  autoRepair: true,
  enableNotifications: true
});

healthMonitor.startMonitoring();

// Get health trends
const trends = healthMonitor.getHealthTrends();
console.log('Repository health trends:', trends);
```

## Performance Optimization

### Git Operation Caching

```javascript
class GitOperationCache {
  constructor(config = {}) {
    this.cache = new Map();
    this.config = {
      maxSize: config.maxSize || 1000,
      ttl: config.ttl || 300000, // 5 minutes
      enableCompression: config.enableCompression !== false
    };
    
    // Set up cache cleanup
    setInterval(() => this.cleanup(), this.config.ttl / 2);
  }

  generateKey(operation, args) {
    return `${operation}:${JSON.stringify(args)}`;
  }

  async get(operation, args, fallback) {
    const key = this.generateKey(operation, args);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.config.ttl) {
      return this.config.enableCompression 
        ? JSON.parse(cached.data) 
        : cached.data;
    }
    
    // Cache miss - execute fallback
    const result = await fallback();
    
    // Store in cache
    this.set(key, result);
    
    return result;
  }

  set(key, data) {
    if (this.cache.size >= this.config.maxSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      data: this.config.enableCompression ? JSON.stringify(data) : data,
      timestamp: Date.now()
    });
  }

  cleanup() {
    const now = Date.now();
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.config.ttl) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      ttl: this.config.ttl
    };
  }
}

class CachedGitOperations {
  constructor(gitManager, cacheConfig = {}) {
    this.gitManager = gitManager;
    this.cache = new GitOperationCache(cacheConfig);
  }

  async getStatus() {
    return await this.cache.get('status', [], () => 
      this.gitManager.getStatus()
    );
  }

  async listBranches() {
    return await this.cache.get('branches', [], () => 
      this.gitManager.listBranches()
    );
  }

  async getCommitHistory(limit = 10) {
    return await this.cache.get('commits', [limit], () => 
      this.gitManager.getCommitHistory(limit)
    );
  }

  async getBranchInfo(branchName) {
    return await this.cache.get('branch-info', [branchName], () => 
      this.gitManager.getBranchInfo(branchName)
    );
  }

  // Non-cached operations that modify state
  async commitFiles(files, message, options) {
    const result = await this.gitManager.commitFiles(files, message, options);
    
    // Invalidate relevant cache entries
    this.cache.clear(); // Simple approach - clear all cache
    
    return result;
  }

  async createBranch(branchName, options) {
    const result = await this.gitManager.createBranch(branchName, options);
    
    // Invalidate branch-related cache
    this.cache.clear();
    
    return result;
  }
}

// Usage
const cachedGitOps = new CachedGitOperations(gitManager, {
  maxSize: 500,
  ttl: 180000, // 3 minutes
  enableCompression: true
});

// These calls will be cached
const status = await cachedGitOps.getStatus();
const branches = await cachedGitOps.listBranches();
const commits = await cachedGitOps.getCommitHistory(20);
```

### Batch Operations

```javascript
class BatchGitOperations {
  constructor(gitManager, config = {}) {
    this.gitManager = gitManager;
    this.config = {
      batchSize: config.batchSize || 10,
      delayBetweenBatches: config.delayBetweenBatches || 100,
      maxConcurrency: config.maxConcurrency || 3
    };
    
    this.operationQueue = [];
    this.processing = false;
  }

  async batchCommitFiles(fileBatches, messageGenerator, options = {}) {
    const results = [];
    
    for (let i = 0; i < fileBatches.length; i += this.config.batchSize) {
      const batch = fileBatches.slice(i, i + this.config.batchSize);
      
      const batchPromises = batch.map(async (fileGroup, index) => {
        const message = typeof messageGenerator === 'function'
          ? await messageGenerator(fileGroup, i + index)
          : `${messageGenerator} (batch ${i + index + 1})`;
        
        return await this.gitManager.commitFiles(fileGroup.files, message, {
          ...options,
          metadata: {
            ...options.metadata,
            batchIndex: i + index,
            batchSize: fileGroup.files.length
          }
        });
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
      
      // Delay between batches to avoid overwhelming the system
      if (i + this.config.batchSize < fileBatches.length) {
        await this.sleep(this.config.delayBetweenBatches);
      }
    }
    
    return results;
  }

  async batchCreateBranches(branchSpecs, options = {}) {
    const results = [];
    const semaphore = new Semaphore(this.config.maxConcurrency);
    
    const branchPromises = branchSpecs.map(async (spec) => {
      await semaphore.acquire();
      
      try {
        return await this.gitManager.createBranch(spec.name, {
          ...options,
          ...spec.options
        });
      } finally {
        semaphore.release();
      }
    });
    
    return await Promise.allSettled(branchPromises);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class Semaphore {
  constructor(maxConcurrency) {
    this.maxConcurrency = maxConcurrency;
    this.currentConcurrency = 0;
    this.queue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (this.currentConcurrency < this.maxConcurrency) {
        this.currentConcurrency++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    this.currentConcurrency--;
    
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.currentConcurrency++;
      next();
    }
  }
}

// Usage
const batchOps = new BatchGitOperations(gitManager, {
  batchSize: 5,
  delayBetweenBatches: 200,
  maxConcurrency: 2
});

// Batch commit multiple file groups
const fileBatches = [
  { files: ['src/auth/login.js', 'src/auth/login.test.js'] },
  { files: ['src/auth/register.js', 'src/auth/register.test.js'] },
  { files: ['src/utils/validation.js', 'src/utils/validation.test.js'] },
  { files: ['docs/auth.md', 'docs/api.md'] }
];

const commitResults = await batchOps.batchCommitFiles(
  fileBatches,
  (fileGroup, index) => `Add ${fileGroup.files[0].split('/').pop()} module`,
  { phase: 'generation' }
);

console.log(`Completed ${commitResults.length} batch commits`);

// Batch create branches
const branchSpecs = [
  { name: 'feature/auth', options: { startPoint: 'main' } },
  { name: 'feature/api', options: { startPoint: 'main' } },
  { name: 'feature/ui', options: { startPoint: 'develop' } }
];

const branchResults = await batchOps.batchCreateBranches(branchSpecs);
console.log(`Created ${branchResults.filter(r => r.status === 'fulfilled').length} branches`);
```

This covers advanced Git integration patterns including custom strategies, intelligent commit orchestration, sophisticated error recovery, and performance optimization techniques. The examples demonstrate real-world scenarios for complex development workflows.

## See Also

- [Basic Usage Examples](./basic-usage.md)
- [Configuration Guide](../configuration.md)
- [API Documentation](../api/)
- [Performance Guide](../guides/performance.md)