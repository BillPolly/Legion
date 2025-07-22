/**
 * Test Commit Message Generation
 * Phase 4.1.3: AI-powered commit message generation
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/module-loader';
import CommitOrchestrator from '../../../src/integration/CommitOrchestrator.js';
import RepositoryManager from '../../../src/integration/RepositoryManager.js';
import GitConfigValidator from '../../../src/config/GitConfigValidator.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Commit Message Generation', () => {
  let resourceManager;
  let repositoryManager;
  let commitOrchestrator;
  let tempDir;

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Register test environment variables
    resourceManager.register('GITHUB_USER', 'TestUser');
    resourceManager.register('GITHUB_PAT', 'ghp_test_token');
  });

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'commit-message-test-'));
    
    // Create and initialize repository manager
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    await repositoryManager.initialize();
    await repositoryManager.initializeRepository();
    
    // Create an initial commit
    await repositoryManager.createInitialCommit('Initial commit for testing');
  });

  afterEach(async () => {
    if (commitOrchestrator) {
      await commitOrchestrator.cleanup();
      commitOrchestrator = null;
    }
    
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

  test('should generate basic commit messages automatically', async () => {
    const config = {
      generateMessages: true,
      messageFormat: 'simple'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create and stage files
    await fs.writeFile(path.join(tempDir, 'feature1.js'), 'export const feature1 = true;');
    await fs.writeFile(path.join(tempDir, 'feature2.js'), 'export const feature2 = true;');
    await commitOrchestrator.stageFiles(['feature1.js', 'feature2.js']);
    
    // Generate commit message
    const message = await commitOrchestrator.generateCommitMessage();
    
    expect(message).toBeTruthy();
    expect(message).toContain('Add 2 files');
    
    console.log('✅ Basic commit message generation working');
  });

  test('should generate phase-specific commit messages', async () => {
    const config = {
      generateMessages: true,
      messageFormat: 'descriptive'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create test files
    await fs.mkdir(path.join(tempDir, '__tests__'), { recursive: true });
    await fs.writeFile(path.join(tempDir, '__tests__', 'unit.test.js'), 'test("works", () => {});');
    await commitOrchestrator.stageFiles(['__tests__/unit.test.js']);
    
    // Generate message with context
    const message = await commitOrchestrator.generateCommitMessage({
      phase: 'testing',
      reason: 'increase test coverage'
    });
    
    expect(message).toBeTruthy();
    expect(message.toLowerCase()).toContain('add');
    expect(message).toContain('increase test coverage');
    
    console.log('✅ Phase-specific commit message generation working');
  });

  test('should generate conventional commit messages', async () => {
    const config = {
      generateMessages: true,
      messageFormat: 'conventional'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Test feature addition
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src', 'newFeature.js'), 'export const newFeature = () => {};');
    await commitOrchestrator.stageFiles(['src/newFeature.js']);
    
    const featureMessage = await commitOrchestrator.generateCommitMessage();
    expect(featureMessage).toMatch(/^feat(\(.+\))?: .+/);
    
    // Test documentation update
    await commitOrchestrator.cleanup();
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Updated Documentation');
    await commitOrchestrator.stageFiles(['README.md']);
    
    const docsMessage = await commitOrchestrator.generateCommitMessage();
    expect(docsMessage).toMatch(/^docs(\(.+\))?: .+/);
    
    console.log('✅ Conventional commit message generation working');
  });

  test('should customize commit messages with options', async () => {
    const config = {
      generateMessages: true,
      messageFormat: 'conventional',
      includeEmoji: true
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create a bug fix
    await fs.writeFile(path.join(tempDir, 'bugfix.js'), 'export const fixed = true;');
    await commitOrchestrator.stageFiles(['bugfix.js']);
    
    const message = await commitOrchestrator.generateCommitMessage({
      type: 'fix',
      scope: 'api',
      description: 'resolve authentication issue'
    });
    
    expect(message).toContain('🐛'); // Bug emoji
    expect(message).toContain('fix(api): resolve authentication issue');
    
    console.log('✅ Customized commit message generation working');
  });

  test('should determine commit type from changes', async () => {
    const config = {
      generateMessages: true,
      messageFormat: 'conventional'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Test various scenarios
    commitOrchestrator.stagedFiles = new Set(['test/new.test.js']);
    const testType = commitOrchestrator.determineCommitType({
      added: ['test/new.test.js'],
      modified: [],
      deleted: [],
      renamed: []
    }, {});  // Provide empty context
    expect(testType).toBe('test');
    
    // Test feature type
    commitOrchestrator.stagedFiles = new Set(['src/feature.js']);
    const featType = commitOrchestrator.determineCommitType({
      added: ['src/feature.js'],
      modified: [],
      deleted: [],
      renamed: []
    }, {});  // Provide empty context
    expect(featType).toBe('feat');
    
    // Test docs type (with modification instead of addition)
    commitOrchestrator.stagedFiles = new Set(['README.md']);
    const docsType = commitOrchestrator.determineCommitType({
      added: [],
      modified: ['README.md'],
      deleted: [],
      renamed: []
    }, {});  // Provide empty context
    expect(docsType).toBe('docs');
    
    console.log('✅ Commit type determination working');
  });

  test('should generate commit body for complex changes', async () => {
    const config = {
      generateMessages: true,
      messageFormat: 'conventional'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create multiple files of different types
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src', 'feature1.js'), 'export const f1 = 1;');
    await fs.writeFile(path.join(tempDir, 'src', 'feature2.js'), 'export const f2 = 2;');
    await fs.writeFile(path.join(tempDir, 'src', 'feature3.js'), 'export const f3 = 3;');
    await fs.writeFile(path.join(tempDir, 'src', 'feature4.js'), 'export const f4 = 4;');
    
    await commitOrchestrator.stageFiles([
      'src/feature1.js',
      'src/feature2.js', 
      'src/feature3.js',
      'src/feature4.js'
    ]);
    
    const message = await commitOrchestrator.generateCommitMessage();
    
    // With more than 3 files, should include body
    expect(message).toContain('\n\n');
    const lines = message.split('\n');
    expect(lines.length).toBeGreaterThan(1);
    
    console.log('✅ Commit body generation for complex changes working');
  });

  test('should validate conventional commit format', async () => {
    const config = {
      messageFormat: 'conventional'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Valid conventional commits
    expect(() => {
      commitOrchestrator.validateCommitMessage('feat: add new feature');
    }).not.toThrow();
    
    expect(() => {
      commitOrchestrator.validateCommitMessage('fix(auth): resolve login issue');
    }).not.toThrow();
    
    expect(() => {
      commitOrchestrator.validateCommitMessage('docs: update README');
    }).not.toThrow();
    
    // Invalid format
    expect(() => {
      commitOrchestrator.validateCommitMessage('This is not conventional format');
    }).toThrow('Commit message must follow conventional format');
    
    console.log('✅ Conventional commit format validation working');
  });

  test('should add emoji based on commit type', async () => {
    const config = {
      generateMessages: true,
      messageFormat: 'conventional',
      includeEmoji: true
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Test different commit types
    const emojiMap = {
      feat: '✨',
      fix: '🐛',
      docs: '📝',
      style: '💄',
      refactor: '♻️',
      test: '✅',
      chore: '🔧'
    };
    
    for (const [type, emoji] of Object.entries(emojiMap)) {
      const result = commitOrchestrator.addCommitEmoji(type);
      expect(result).toBe(emoji);
    }
    
    console.log('✅ Emoji addition based on commit type working');
  });

  test('should handle breaking changes in commit messages', async () => {
    const config = {
      generateMessages: true,
      messageFormat: 'conventional'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create a file
    await fs.writeFile(path.join(tempDir, 'api.js'), 'export const api = { version: 2 };');
    await commitOrchestrator.stageFiles(['api.js']);
    
    // Generate message with breaking change
    const message = await commitOrchestrator.generateCommitMessage({
      type: 'feat',
      scope: 'api',
      description: 'update API to v2',
      breaking: 'API v1 is no longer supported'
    });
    
    expect(message).toContain('feat(api): update API to v2');
    expect(message).toContain('BREAKING CHANGE: API v1 is no longer supported');
    
    console.log('✅ Breaking change handling in commit messages working');
  });

  test('should respect message length limits', async () => {
    const config = {
      generateMessages: true,
      maxMessageLength: 50,
      messageFormat: 'simple'  // Don't enforce conventional format
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Test validation
    const longMessage = 'This is a very long commit message that definitely exceeds the 50 character limit';
    
    expect(() => {
      commitOrchestrator.validateCommitMessage(longMessage);
    }).toThrow('First line of commit message exceeds 50 characters');
    
    // Multi-line message should only check first line
    const multiLineMessage = 'Short first line\n\nThis is a much longer second line that can exceed the limit';
    
    expect(() => {
      commitOrchestrator.validateCommitMessage(multiLineMessage);
    }).not.toThrow();
    
    console.log('✅ Message length limit validation working');
  });
});