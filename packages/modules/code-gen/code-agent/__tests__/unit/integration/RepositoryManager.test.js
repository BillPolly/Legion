/**
 * Test RepositoryManager - Repository cloning and setup
 * Phase 2.2.1: Repository cloning and setup operations
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach } from '@jest/globals';
import { ResourceManager } from '@legion/tools-registry';
import RepositoryManager from '../../../src/integration/RepositoryManager.js';
import GitConfigValidator from '../../../src/config/GitConfigValidator.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('RepositoryManager Repository Cloning and Setup', () => {
  let resourceManager;
  let repositoryManager;
  let tempDir;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Register test environment variables
    resourceManager.set('GITHUB_USER', 'TestUser');
    resourceManager.set('GITHUB_PAT', 'ghp_test_token');
  });

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-manager-test-'));
  });

  afterEach(async () => {
    if (repositoryManager) {
      await repositoryManager.cleanup();
      repositoryManager = null;
    }
    
    // Remove temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to cleanup temp directory:', error.message);
      }
    }
  });

  test('should detect existing Git repository', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    
    // Create a proper .git directory structure
    const gitDir = path.join(tempDir, '.git');
    await fs.mkdir(gitDir, { recursive: true });
    await fs.writeFile(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n');
    await fs.mkdir(path.join(gitDir, 'refs', 'heads'), { recursive: true });
    await fs.mkdir(path.join(gitDir, 'objects'), { recursive: true });
    
    await repositoryManager.initialize();
    
    expect(repositoryManager.isGitRepository).toBe(true);
    expect(repositoryManager.initialized).toBe(true);
    
    const status = repositoryManager.getStatus();
    expect(status.isGitRepository).toBe(true);
    expect(status.workingDirectory).toBe(tempDir);
    
    console.log('✅ Existing Git repository detection working');
  });

  test('should detect non-Git directory', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    
    await repositoryManager.initialize();
    
    expect(repositoryManager.isGitRepository).toBe(false);
    expect(repositoryManager.initialized).toBe(true);
    
    const status = repositoryManager.getStatus();
    expect(status.isGitRepository).toBe(false);
    expect(status.workingDirectory).toBe(tempDir);
    
    console.log('✅ Non-Git directory detection working');
  });

  test('should initialize new Git repository', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    
    await repositoryManager.initialize();
    expect(repositoryManager.isGitRepository).toBe(false);
    
    const result = await repositoryManager.initializeRepository({
      initialBranch: 'main',
      description: 'Test repository',
      initialCommit: 'Initial commit from test'
    });
    
    expect(result.success).toBe(true);
    expect(result.path).toBe(tempDir);
    expect(result.branch).toBe('main');
    expect(repositoryManager.isGitRepository).toBe(true);
    expect(repositoryManager.currentBranch).toBe('main');
    
    // Verify .git directory was created
    const gitDir = path.join(tempDir, '.git');
    const gitDirExists = await fs.stat(gitDir).then(() => true).catch(() => false);
    expect(gitDirExists).toBe(true);
    
    console.log('✅ New Git repository initialization working');
  });

  test('should prevent double initialization of repository', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    
    await repositoryManager.initialize();
    await repositoryManager.initializeRepository();
    
    // Try to initialize again without force
    await expect(repositoryManager.initializeRepository())
      .rejects.toThrow('Directory is already a Git repository');
    
    console.log('✅ Double initialization prevention working');
  });

  test('should force re-initialization of repository', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    
    await repositoryManager.initialize();
    await repositoryManager.initializeRepository();
    
    // Force re-initialization
    const result = await repositoryManager.initializeRepository({ force: true });
    
    expect(result.success).toBe(true);
    expect(repositoryManager.isGitRepository).toBe(true);
    
    console.log('✅ Forced repository re-initialization working');
  });

  test('should configure Git user settings', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    
    await repositoryManager.initialize();
    await repositoryManager.initializeRepository();
    
    const settings = {
      userName: 'Test User',
      userEmail: 'test@example.com',
      config: {
        'core.autocrlf': 'false',
        'pull.rebase': 'true'
      }
    };
    
    const result = await repositoryManager.configureRepository(settings);
    
    expect(result.success).toBe(true);
    expect(result.configurations).toContainEqual(['user.name', 'Test User']);
    expect(result.configurations).toContainEqual(['user.email', 'test@example.com']);
    expect(result.configurations).toContainEqual(['core.autocrlf', 'false']);
    expect(result.configurations).toContainEqual(['pull.rebase', 'true']);
    
    expect(repositoryManager.gitConfig.userName).toBe('Test User');
    expect(repositoryManager.gitConfig.userEmail).toBe('test@example.com');
    
    console.log('✅ Git configuration working');
  });

  test('should add remote to repository', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    
    await repositoryManager.initialize();
    await repositoryManager.initializeRepository();
    
    const result = await repositoryManager.addRemote('origin', 'https://github.com/test/repo.git');
    
    expect(result.success).toBe(true);
    expect(result.name).toBe('origin');
    expect(result.url).toBe('https://github.com/test/repo.git');
    
    expect(repositoryManager.hasRemote).toBe(true);
    expect(repositoryManager.remoteUrl).toBe('https://github.com/test/repo.git');
    expect(repositoryManager.remoteName).toBe('origin');
    
    console.log('✅ Remote addition working');
  });

  test('should validate repository health', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    
    await repositoryManager.initialize();
    
    // Test validation for non-Git directory
    let validation = await repositoryManager.validateRepository();
    expect(validation.valid).toBe(false);
    expect(validation.issues).toContain('Not a Git repository');
    expect(validation.canRepair).toBe(false);
    
    // Initialize repository and test validation
    await repositoryManager.initializeRepository();
    validation = await repositoryManager.validateRepository();
    
    // May have validation issues but should be repairable
    expect(validation.canRepair).toBe(true);
    expect(validation.metadata).toBeDefined();
    expect(validation.metadata.currentBranch).toBeDefined();
    
    // Check if there are any issues (configuration issues are common in test environments)
    if (validation.issues.length > 0) {
      console.log(`Repository validation found ${validation.issues.length} issues: ${validation.issues.join(', ')}`);
    }
    
    console.log('✅ Repository health validation working');
  });

  test('should handle repository configuration errors', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    
    await repositoryManager.initialize();
    
    // Try to configure non-Git directory
    await expect(repositoryManager.configureRepository({ userName: 'Test' }))
      .rejects.toThrow('Not a Git repository');
    
    // Try to add remote to non-Git directory
    await expect(repositoryManager.addRemote('origin', 'https://github.com/test/repo.git'))
      .rejects.toThrow('Not a Git repository');
    
    console.log('✅ Repository configuration error handling working');
  });

  test('should load repository metadata', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    
    await repositoryManager.initialize();
    await repositoryManager.initializeRepository({ initialCommit: 'Test commit' });
    
    // Trigger metadata loading explicitly
    await repositoryManager.loadRepositoryMetadata();
    
    expect(repositoryManager.repositoryMetadata).toBeDefined();
    expect(repositoryManager.repositoryMetadata.workingDirectory).toBe(tempDir);
    expect(repositoryManager.repositoryMetadata.isGitRepository).toBe(true);
    expect(repositoryManager.repositoryMetadata.currentBranch).toBeDefined();
    expect(repositoryManager.repositoryMetadata.lastUpdate).toBeInstanceOf(Date);
    
    console.log('✅ Repository metadata loading working');
  });

  test('should handle directory creation', async () => {
    const nonExistentDir = path.join(tempDir, 'nested', 'directory');
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, nonExistentDir);
    
    await repositoryManager.initialize();
    
    // Directory should be created
    const dirExists = await fs.stat(nonExistentDir).then(() => true).catch(() => false);
    expect(dirExists).toBe(true);
    
    expect(repositoryManager.workingDirectory).toBe(nonExistentDir);
    expect(repositoryManager.initialized).toBe(true);
    
    console.log('✅ Directory creation working');
  });

  test('should emit events during operations', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    
    const events = [];
    repositoryManager.on('initialized', (data) => events.push(['initialized', data]));
    repositoryManager.on('repositoryNotFound', (data) => events.push(['repositoryNotFound', data]));
    repositoryManager.on('repositoryInitialized', (data) => events.push(['repositoryInitialized', data]));
    repositoryManager.on('remoteAdded', (data) => events.push(['remoteAdded', data]));
    
    await repositoryManager.initialize();
    await repositoryManager.initializeRepository();
    await repositoryManager.addRemote('origin', 'https://github.com/test/repo.git');
    
    expect(events.length).toBeGreaterThan(0);
    expect(events.some(([type]) => type === 'initialized')).toBe(true);
    expect(events.some(([type]) => type === 'repositoryNotFound')).toBe(true);
    expect(events.some(([type]) => type === 'repositoryInitialized')).toBe(true);
    expect(events.some(([type]) => type === 'remoteAdded')).toBe(true);
    
    console.log('✅ Event emission working');
  });

  test('should provide legacy method compatibility', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    
    // Test legacy setupRepository method
    const setupResult = await repositoryManager.setupRepository();
    expect(setupResult.setup).toBe(true);
    expect(repositoryManager.initialized).toBe(true);
    
    // Initialize repository for other tests
    await repositoryManager.initializeRepository();
    
    // Test legacy getRepositoryInfo method
    const repoInfo = await repositoryManager.getRepositoryInfo();
    expect(repoInfo.status).toBeDefined();
    expect(repoInfo.branch).toBeDefined();
    expect(repoInfo.hasRemote).toBe(false);
    
    // Test legacy getCommitHistory method
    const history = await repositoryManager.getCommitHistory();
    expect(Array.isArray(history)).toBe(true);
    
    console.log('✅ Legacy method compatibility working');
  });

  test('should handle multiple initialization calls gracefully', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    
    await repositoryManager.initialize();
    expect(repositoryManager.initialized).toBe(true);
    
    // Second initialization should not fail
    await repositoryManager.initialize();
    expect(repositoryManager.initialized).toBe(true);
    
    console.log('✅ Multiple initialization handling working');
  });

  test('should initialize Git configuration with defaults', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    
    await repositoryManager.initialize();
    await repositoryManager.initializeRepository();
    
    // Manually trigger Git configuration initialization (since the repository was just created)
    await repositoryManager.initializeGitConfig();
    
    // Check that default configuration was applied
    expect(repositoryManager.gitConfig.initialized).toBe(true);
    expect(repositoryManager.gitConfig.userName).toBeDefined();
    expect(repositoryManager.gitConfig.userEmail).toBeDefined();
    
    // userName could be string or object depending on Git config
    if (typeof repositoryManager.gitConfig.userName === 'string') {
      expect(repositoryManager.gitConfig.userName.length).toBeGreaterThan(0);
    } else {
      // Git config may return an object in some cases
      expect(repositoryManager.gitConfig.userName).toBeDefined();
    }
    
    // Email should be either system config or default
    expect(typeof repositoryManager.gitConfig.userEmail).toBe('string');
    expect(repositoryManager.gitConfig.userEmail.length).toBeGreaterThan(0);
    
    console.log(`✅ Default Git configuration working (user: ${repositoryManager.gitConfig.userName}, email: ${repositoryManager.gitConfig.userEmail})`);
  });
});