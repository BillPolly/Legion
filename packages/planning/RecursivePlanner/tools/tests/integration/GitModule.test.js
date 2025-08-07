/**
 * Integration tests for Git Module
 * Tests Git operations wrapped as tools
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { 
  GitModuleDefinition,
  GitModuleInstance 
} from '../../src/modules/GitModule.js';

// Mock simple-git for testing
const mockGit = {
  init: jest.fn().mockResolvedValue(),
  clone: jest.fn().mockResolvedValue(),
  add: jest.fn().mockResolvedValue(),
  commit: jest.fn().mockResolvedValue(),
  push: jest.fn().mockResolvedValue(),
  pull: jest.fn().mockResolvedValue(),
  fetch: jest.fn().mockResolvedValue(),
  checkout: jest.fn().mockResolvedValue(),
  checkoutBranch: jest.fn().mockResolvedValue(),
  branch: jest.fn().mockResolvedValue({ all: ['main', 'develop'] }),
  branchLocal: jest.fn().mockResolvedValue({ all: ['main', 'develop'] }),
  status: jest.fn().mockResolvedValue({
    current: 'main',
    tracking: 'origin/main',
    modified: ['file1.txt'],
    not_added: ['file2.txt'],
    deleted: [],
    created: [],
    conflicted: [],
    ahead: 0,
    behind: 0,
    files: [
      { path: 'file1.txt', index: 'M', working_dir: 'M' },
      { path: 'file2.txt', index: '?', working_dir: '?' }
    ]
  }),
  log: jest.fn().mockResolvedValue({
    all: [
      {
        hash: 'abc123',
        date: '2024-01-01',
        message: 'Initial commit',
        author_name: 'Test User',
        author_email: 'test@example.com'
      }
    ]
  }),
  diff: jest.fn().mockResolvedValue('diff --git a/file1.txt b/file1.txt\n...'),
  diffSummary: jest.fn().mockResolvedValue({
    changed: 1,
    insertions: 5,
    deletions: 2,
    files: [{ file: 'file1.txt', changes: 7, insertions: 5, deletions: 2 }]
  }),
  merge: jest.fn().mockResolvedValue(),
  rebase: jest.fn().mockResolvedValue(),
  reset: jest.fn().mockResolvedValue(),
  revert: jest.fn().mockResolvedValue(),
  stash: jest.fn().mockResolvedValue(),
  stashList: jest.fn().mockResolvedValue({
    all: ['stash@{0}: WIP on main: abc123 Test']
  }),
  stashPop: jest.fn().mockResolvedValue(),
  tags: jest.fn().mockResolvedValue({ all: ['v1.0.0', 'v1.0.1'] }),
  addTag: jest.fn().mockResolvedValue(),
  remote: jest.fn().mockResolvedValue(['origin']),
  getRemotes: jest.fn().mockResolvedValue([
    { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git', push: 'https://github.com/user/repo.git' }}
  ]),
  addRemote: jest.fn().mockResolvedValue(),
  removeRemote: jest.fn().mockResolvedValue(),
  show: jest.fn().mockResolvedValue('file contents'),
  blame: jest.fn().mockResolvedValue([
    { hash: 'abc123', author: 'Test User', date: '2024-01-01', line: 'Line 1' }
  ])
};

const mockSimpleGit = jest.fn(() => mockGit);

describe('Git Module Integration', () => {
  let testDir;
  let module;
  let instance;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-module-test-'));
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create module instance with mock git
    instance = await GitModuleDefinition.create({
      repoPath: testDir,
      simpleGit: mockSimpleGit
    });
    
    module = instance;
  });

  afterEach(async () => {
    // Clean up
    if (instance && instance.cleanup) {
      await instance.cleanup();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Repository operations', () => {
    test('should initialize repository', async () => {
      const initTool = module.getTool('init');
      
      const result = await initTool.execute({
        bare: false
      });

      expect(mockGit.init).toHaveBeenCalledWith(false);
      expect(result.success).toBe(true);
      expect(result.message).toContain('initialized');
    });

    test('should clone repository', async () => {
      const cloneTool = module.getTool('clone');
      
      const result = await cloneTool.execute({
        url: 'https://github.com/user/repo.git',
        path: './cloned-repo',
        options: { depth: 1 }
      });

      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://github.com/user/repo.git',
        './cloned-repo',
        { depth: 1 }
      );
      expect(result.success).toBe(true);
      expect(result.handle).toBeDefined();
      expect(result.type).toBe('repository');
    });

    test('should get repository status', async () => {
      const statusTool = module.getTool('status');
      
      const result = await statusTool.execute({});

      expect(mockGit.status).toHaveBeenCalled();
      expect(result.current).toBe('main');
      expect(result.modified).toContain('file1.txt');
      expect(result.not_added).toContain('file2.txt');
    });

    test('should get commit log', async () => {
      const logTool = module.getTool('log');
      
      const result = await logTool.execute({
        maxCount: 10
      });

      expect(mockGit.log).toHaveBeenCalledWith({ maxCount: 10 });
      expect(result.commits).toHaveLength(1);
      expect(result.commits[0].hash).toBe('abc123');
      expect(result.commits[0].message).toBe('Initial commit');
    });
  });

  describe('File operations', () => {
    test('should add files to staging', async () => {
      const addTool = module.getTool('add');
      
      const result = await addTool.execute({
        files: ['file1.txt', 'file2.txt']
      });

      expect(mockGit.add).toHaveBeenCalledWith(['file1.txt', 'file2.txt']);
      expect(result.success).toBe(true);
    });

    test('should commit changes', async () => {
      const commitTool = module.getTool('commit');
      
      const result = await commitTool.execute({
        message: 'Test commit',
        options: { '--no-verify': null }
      });

      expect(mockGit.commit).toHaveBeenCalledWith('Test commit', undefined, { '--no-verify': null });
      expect(result.success).toBe(true);
    });

    test('should show diff', async () => {
      const diffTool = module.getTool('diff');
      
      const result = await diffTool.execute({
        options: ['--cached']
      });

      expect(mockGit.diff).toHaveBeenCalledWith(['--cached']);
      expect(result.diff).toContain('diff --git');
    });

    test('should show diff summary', async () => {
      const diffSummaryTool = module.getTool('diffSummary');
      
      const result = await diffSummaryTool.execute({});

      expect(mockGit.diffSummary).toHaveBeenCalled();
      expect(result.changed).toBe(1);
      expect(result.insertions).toBe(5);
      expect(result.deletions).toBe(2);
    });

    test('should show file contents', async () => {
      const showTool = module.getTool('show');
      
      const result = await showTool.execute({
        ref: 'HEAD:file1.txt'
      });

      expect(mockGit.show).toHaveBeenCalledWith('HEAD:file1.txt');
      expect(result.content).toBe('file contents');
    });

    test('should show blame information', async () => {
      const blameTool = module.getTool('blame');
      
      const result = await blameTool.execute({
        file: 'file1.txt'
      });

      expect(mockGit.blame).toHaveBeenCalledWith('file1.txt');
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].author).toBe('Test User');
    });
  });

  describe('Branch operations', () => {
    test('should list branches', async () => {
      const branchTool = module.getTool('branch');
      
      const result = await branchTool.execute({});

      expect(mockGit.branchLocal).toHaveBeenCalled();
      expect(result.branches).toContain('main');
      expect(result.branches).toContain('develop');
    });

    test('should checkout branch', async () => {
      const checkoutTool = module.getTool('checkout');
      
      const result = await checkoutTool.execute({
        branch: 'develop'
      });

      expect(mockGit.checkout).toHaveBeenCalledWith('develop');
      expect(result.success).toBe(true);
    });

    test('should create new branch', async () => {
      const checkoutTool = module.getTool('checkout');
      
      const result = await checkoutTool.execute({
        branch: 'feature/new',
        createNew: true
      });

      expect(mockGit.checkoutBranch).toHaveBeenCalledWith('feature/new', 'HEAD');
      expect(result.success).toBe(true);
    });

    test('should merge branches', async () => {
      const mergeTool = module.getTool('merge');
      
      const result = await mergeTool.execute({
        from: 'develop',
        options: { '--no-ff': null }
      });

      expect(mockGit.merge).toHaveBeenCalledWith(['develop', '--no-ff']);
      expect(result.success).toBe(true);
    });

    test('should rebase branch', async () => {
      const rebaseTool = module.getTool('rebase');
      
      const result = await rebaseTool.execute({
        branch: 'main'
      });

      expect(mockGit.rebase).toHaveBeenCalledWith(['main']);
      expect(result.success).toBe(true);
    });
  });

  describe('Remote operations', () => {
    test('should push to remote', async () => {
      const pushTool = module.getTool('push');
      
      const result = await pushTool.execute({
        remote: 'origin',
        branch: 'main',
        options: { '--set-upstream': null }
      });

      expect(mockGit.push).toHaveBeenCalledWith('origin', 'main', { '--set-upstream': null });
      expect(result.success).toBe(true);
    });

    test('should pull from remote', async () => {
      const pullTool = module.getTool('pull');
      
      const result = await pullTool.execute({
        remote: 'origin',
        branch: 'main',
        options: { '--rebase': null }
      });

      expect(mockGit.pull).toHaveBeenCalledWith('origin', 'main', { '--rebase': null });
      expect(result.success).toBe(true);
    });

    test('should fetch from remote', async () => {
      const fetchTool = module.getTool('fetch');
      
      const result = await fetchTool.execute({
        remote: 'origin',
        options: { '--prune': null }
      });

      expect(mockGit.fetch).toHaveBeenCalledWith('origin', { '--prune': null });
      expect(result.success).toBe(true);
    });

    test('should list remotes', async () => {
      const remoteTool = module.getTool('remote');
      
      const result = await remoteTool.execute({
        command: 'list'
      });

      expect(mockGit.getRemotes).toHaveBeenCalledWith(true);
      expect(result.remotes).toHaveLength(1);
      expect(result.remotes[0].name).toBe('origin');
    });

    test('should add remote', async () => {
      const remoteTool = module.getTool('remote');
      
      const result = await remoteTool.execute({
        command: 'add',
        name: 'upstream',
        url: 'https://github.com/upstream/repo.git'
      });

      expect(mockGit.addRemote).toHaveBeenCalledWith('upstream', 'https://github.com/upstream/repo.git');
      expect(result.success).toBe(true);
    });
  });

  describe('Stash operations', () => {
    test('should stash changes', async () => {
      const stashTool = module.getTool('stash');
      
      const result = await stashTool.execute({
        command: 'push',
        message: 'WIP changes'
      });

      expect(mockGit.stash).toHaveBeenCalledWith(['push', '-m', 'WIP changes']);
      expect(result.success).toBe(true);
    });

    test('should list stashes', async () => {
      const stashTool = module.getTool('stash');
      
      const result = await stashTool.execute({
        command: 'list'
      });

      expect(mockGit.stashList).toHaveBeenCalled();
      expect(result.stashes).toHaveLength(1);
      expect(result.stashes[0]).toContain('WIP on main');
    });

    test('should pop stash', async () => {
      const stashTool = module.getTool('stash');
      
      const result = await stashTool.execute({
        command: 'pop'
      });

      expect(mockGit.stashPop).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('Tag operations', () => {
    test('should list tags', async () => {
      const tagTool = module.getTool('tag');
      
      const result = await tagTool.execute({
        command: 'list'
      });

      expect(mockGit.tags).toHaveBeenCalled();
      expect(result.tags).toContain('v1.0.0');
      expect(result.tags).toContain('v1.0.1');
    });

    test('should create tag', async () => {
      const tagTool = module.getTool('tag');
      
      const result = await tagTool.execute({
        command: 'create',
        name: 'v1.1.0',
        message: 'Release v1.1.0'
      });

      expect(mockGit.addTag).toHaveBeenCalledWith('v1.1.0', 'Release v1.1.0');
      expect(result.success).toBe(true);
    });
  });

  describe('Reset and revert operations', () => {
    test('should reset changes', async () => {
      const resetTool = module.getTool('reset');
      
      const result = await resetTool.execute({
        mode: 'hard',
        ref: 'HEAD~1'
      });

      expect(mockGit.reset).toHaveBeenCalledWith(['--hard', 'HEAD~1']);
      expect(result.success).toBe(true);
    });

    test('should revert commit', async () => {
      const revertTool = module.getTool('revert');
      
      const result = await revertTool.execute({
        commit: 'abc123'
      });

      expect(mockGit.revert).toHaveBeenCalledWith('abc123', { '--no-edit': null });
      expect(result.success).toBe(true);
    });
  });

  describe('Error handling', () => {
    test('should handle git command errors', async () => {
      mockGit.status.mockRejectedValueOnce(new Error('Not a git repository'));
      
      const statusTool = module.getTool('status');
      const result = await statusTool.execute({});
      
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Not a git repository');
    });

    test('should handle invalid operations', async () => {
      const remoteTool = module.getTool('remote');
      
      const result = await remoteTool.execute({
        command: 'invalid'
      });
      
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Invalid remote command');
    });
  });
});