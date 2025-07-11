/**
 * Unit tests for GitHub Tool
 */

import { jest } from '@jest/globals';
import GitHub from '../../src/github/index.js';
import { createMockToolCall, validateToolResult } from '../utils/test-helpers.js';

// Mock fs module
const mockFs = {
  promises: {
    readFile: jest.fn()
  }
};

// Mock https module
const mockHttpsRequest = jest.fn();
const mockExecAsync = jest.fn();

jest.unstable_mockModule('fs', () => mockFs);
jest.unstable_mockModule('https', () => ({
  default: {
    request: mockHttpsRequest
  }
}));
jest.unstable_mockModule('child_process', () => ({
  exec: jest.fn()
}));
jest.unstable_mockModule('util', () => ({
  promisify: jest.fn(() => mockExecAsync)
}));

describe('GitHub', () => {
  let github;

  beforeEach(() => {
    github = new GitHub();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(github.name).toBe('github');
      expect(github.description).toBe('Creates GitHub repositories and manages git operations');
      expect(github.githubApiBase).toBe('api.github.com');
    });
  });

  describe('getAllToolDescriptions', () => {
    test('should return all three GitHub functions', () => {
      const descriptions = github.getAllToolDescriptions();
      
      expect(descriptions).toHaveLength(3);
      expect(descriptions[0].function.name).toBe('github_create_repo');
      expect(descriptions[1].function.name).toBe('github_push_to_repo');
      expect(descriptions[2].function.name).toBe('github_create_and_push');
    });

    test('should have correct parameter schemas', () => {
      const descriptions = github.getAllToolDescriptions();
      
      // Create repo
      expect(descriptions[0].function.parameters.required).toContain('repoName');
      expect(descriptions[0].function.parameters.properties.private.type).toBe('boolean');
      
      // Push to repo
      expect(descriptions[1].function.parameters.required).toContain('repoUrl');
      expect(descriptions[1].function.parameters.properties.force.type).toBe('boolean');
      
      // Create and push
      expect(descriptions[2].function.parameters.required).toContain('repoName');
      expect(descriptions[2].function.parameters.properties.branch.type).toBe('string');
    });
  });

  describe('getCredentials method', () => {
    test('should read PAT from .env file', async () => {
      const envContent = 'ANTHROPIC_API_KEY=sk-test\nGITHUB_PAT=ghp_test123\nOTHER=value';
      mockFs.promises.readFile.mockResolvedValue(envContent);

      const creds = await github.getCredentials();

      expect(creds.token).toBe('ghp_test123');
      expect(mockFs.promises.readFile).toHaveBeenCalledWith(
        expect.stringContaining('.env'),
        'utf8'
      );
    });

    test('should fallback to environment variable', async () => {
      mockFs.promises.readFile.mockRejectedValue(new Error('File not found'));
      process.env.GITHUB_PAT = 'env_pat_token';

      const creds = await github.getCredentials();

      expect(creds.token).toBe('env_pat_token');
      
      delete process.env.GITHUB_PAT;
    });

    test('should throw error when no PAT found', async () => {
      mockFs.promises.readFile.mockRejectedValue(new Error('File not found'));
      delete process.env.GITHUB_PAT;

      await expect(github.getCredentials()).rejects.toThrow('GitHub PAT not found');
    });

    test('should handle .env file with whitespace', async () => {
      const envContent = 'GITHUB_PAT=  ghp_whitespace_token  \n';
      mockFs.promises.readFile.mockResolvedValue(envContent);

      const creds = await github.getCredentials();

      expect(creds.token).toBe('ghp_whitespace_token');
    });
  });

  describe('getGitHubUsername method', () => {
    test('should fetch username from GitHub API', async () => {
      const mockResponse = {
        statusCode: 200,
        on: jest.fn()
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      mockHttpsRequest.mockImplementation((options, callback) => {
        expect(options.headers.Authorization).toBe('token test-token');
        setTimeout(() => {
          callback(mockResponse);
          const dataHandler = mockResponse.on.mock.calls.find(call => call[0] === 'data')[1];
          const endHandler = mockResponse.on.mock.calls.find(call => call[0] === 'end')[1];
          
          dataHandler(JSON.stringify({ login: 'testuser' }));
          endHandler();
        }, 0);
        return mockRequest;
      });

      const username = await github.getGitHubUsername('test-token');

      expect(username).toBe('testuser');
    });

    test('should handle API error', async () => {
      const mockResponse = {
        statusCode: 401,
        on: jest.fn()
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      mockHttpsRequest.mockImplementation((options, callback) => {
        setTimeout(() => {
          callback(mockResponse);
          const endHandler = mockResponse.on.mock.calls.find(call => call[0] === 'end')[1];
          endHandler();
        }, 0);
        return mockRequest;
      });

      await expect(github.getGitHubUsername('invalid-token')).rejects.toThrow('Failed to get user info');
    });
  });

  describe('createRepo method', () => {
    test('should create repository successfully', async () => {
      mockFs.promises.readFile.mockResolvedValue('GITHUB_PAT=test-token');

      const mockResponse = {
        statusCode: 201,
        on: jest.fn()
      };

      const mockRequest = {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };

      const mockRepoData = {
        name: 'test-repo',
        html_url: 'https://github.com/user/test-repo',
        clone_url: 'https://github.com/user/test-repo.git',
        ssh_url: 'git@github.com:user/test-repo.git',
        private: false
      };

      mockHttpsRequest.mockImplementation((options, callback) => {
        setTimeout(() => {
          callback(mockResponse);
          const dataHandler = mockResponse.on.mock.calls.find(call => call[0] === 'data')[1];
          const endHandler = mockResponse.on.mock.calls.find(call => call[0] === 'end')[1];
          
          dataHandler(JSON.stringify(mockRepoData));
          endHandler();
        }, 0);
        return mockRequest;
      });

      const result = await github.createRepo('test-repo', 'Test description', false, false);

      expect(result.success).toBe(true);
      expect(result.name).toBe('test-repo');
      expect(result.url).toBe('https://github.com/user/test-repo');
      expect(result.private).toBe(false);
    });

    test('should handle repository creation failure', async () => {
      mockFs.promises.readFile.mockResolvedValue('GITHUB_PAT=test-token');

      const mockResponse = {
        statusCode: 422,
        on: jest.fn()
      };

      const mockRequest = {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpsRequest.mockImplementation((options, callback) => {
        setTimeout(() => {
          callback(mockResponse);
          const dataHandler = mockResponse.on.mock.calls.find(call => call[0] === 'data')[1];
          const endHandler = mockResponse.on.mock.calls.find(call => call[0] === 'end')[1];
          
          dataHandler(JSON.stringify({ message: 'Repository already exists' }));
          endHandler();
        }, 0);
        return mockRequest;
      });

      await expect(github.createRepo('existing-repo')).rejects.toThrow('Repository already exists');
    });
  });

  describe('pushToRepo method', () => {
    test('should push to repository successfully', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git' }) // git rev-parse --git-dir
        .mockResolvedValueOnce({ stdout: 'main' }) // git branch --show-current
        .mockResolvedValueOnce({ stdout: '' }) // git remote remove (may fail)
        .mockResolvedValueOnce({ stdout: '' }) // git remote add
        .mockResolvedValueOnce({ stdout: 'Pushed successfully', stderr: '' }) // git push
        .mockResolvedValueOnce({ stdout: '' }); // git remote remove

      const result = await github.pushToRepo('https://github.com/user/repo.git', 'main', false);

      expect(result.success).toBe(true);
      expect(result.sourceBranch).toBe('main');
      expect(result.targetBranch).toBe('main');
      expect(result.forced).toBe(false);
    });

    test('should handle force push', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git' })
        .mockResolvedValueOnce({ stdout: 'dev' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: 'Force pushed', stderr: '' })
        .mockResolvedValueOnce({ stdout: '' });

      const result = await github.pushToRepo('https://github.com/user/repo.git', 'main', true);

      expect(result.forced).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('--force')
      );
    });

    test('should handle push failure', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git' })
        .mockResolvedValueOnce({ stdout: 'main' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockRejectedValueOnce(new Error('Push failed'));

      await expect(github.pushToRepo('https://github.com/user/repo.git')).rejects.toThrow('Failed to push');
    });

    test('should handle non-git directory', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Not a git repository'));

      await expect(github.pushToRepo('https://github.com/user/repo.git')).rejects.toThrow('Failed to push');
    });
  });

  describe('createAndPush method', () => {
    test('should create repo and push successfully', async () => {
      // Mock credentials
      mockFs.promises.readFile.mockResolvedValue('GITHUB_PAT=test-token');

      // Mock git status check (repo exists)
      mockExecAsync.mockResolvedValueOnce({ stdout: '.git' });

      // Mock createRepo
      github.createRepo = jest.fn().mockResolvedValue({
        name: 'test-repo',
        url: 'https://github.com/user/test-repo',
        cloneUrl: 'https://github.com/user/test-repo.git'
      });

      // Mock getGitHubUsername
      github.getGitHubUsername = jest.fn().mockResolvedValue('testuser');

      // Mock pushToRepo
      github.pushToRepo = jest.fn().mockResolvedValue({
        success: true,
        sourceBranch: 'main',
        targetBranch: 'main'
      });

      const result = await github.createAndPush('test-repo', 'Test description');

      expect(result.success).toBe(true);
      expect(result.repository.name).toBe('test-repo');
      expect(github.createRepo).toHaveBeenCalledWith('test-repo', 'Test description', false, false);
      expect(github.pushToRepo).toHaveBeenCalled();
    });

    test('should initialize git repo if not exists', async () => {
      mockFs.promises.readFile.mockResolvedValue('GITHUB_PAT=test-token');

      // Mock git status check (not a repo)
      mockExecAsync
        .mockRejectedValueOnce(new Error('Not a git repository')) // git rev-parse --git-dir
        .mockResolvedValueOnce({ stdout: '' }) // git init
        .mockResolvedValueOnce({ stdout: '' }) // git add .
        .mockResolvedValueOnce({ stdout: '' }); // git commit

      github.createRepo = jest.fn().mockResolvedValue({
        cloneUrl: 'https://github.com/user/test-repo.git'
      });
      github.getGitHubUsername = jest.fn().mockResolvedValue('testuser');
      github.pushToRepo = jest.fn().mockResolvedValue({ success: true });

      await github.createAndPush('test-repo');

      expect(mockExecAsync).toHaveBeenCalledWith('git init');
      expect(mockExecAsync).toHaveBeenCalledWith('git add .');
      expect(mockExecAsync).toHaveBeenCalledWith('git commit -m "Initial commit"');
    });
  });

  describe('invoke method', () => {
    test('should route github_create_repo calls correctly', async () => {
      github.createRepo = jest.fn().mockResolvedValue({
        success: true,
        name: 'test-repo'
      });

      const toolCall = createMockToolCall('github_create_repo', { 
        repoName: 'test-repo',
        description: 'Test repo',
        private: true
      });
      const result = await github.invoke(toolCall);

      expect(result.success).toBe(true);
      expect(github.createRepo).toHaveBeenCalledWith('test-repo', 'Test repo', true, undefined);
    });

    test('should route github_push_to_repo calls correctly', async () => {
      github.pushToRepo = jest.fn().mockResolvedValue({
        success: true
      });

      const toolCall = createMockToolCall('github_push_to_repo', { 
        repoUrl: 'https://github.com/user/repo.git',
        branch: 'dev',
        force: true
      });
      const result = await github.invoke(toolCall);

      expect(result.success).toBe(true);
      expect(github.pushToRepo).toHaveBeenCalledWith(
        'https://github.com/user/repo.git', 
        'dev', 
        true
      );
    });

    test('should route github_create_and_push calls correctly', async () => {
      github.createAndPush = jest.fn().mockResolvedValue({
        success: true
      });

      const toolCall = createMockToolCall('github_create_and_push', { 
        repoName: 'new-repo',
        description: 'New repo',
        private: false,
        branch: 'develop'
      });
      const result = await github.invoke(toolCall);

      expect(result.success).toBe(true);
      expect(github.createAndPush).toHaveBeenCalledWith(
        'new-repo', 
        'New repo', 
        false, 
        'develop'
      );
    });

    test('should handle unknown function names', async () => {
      const toolCall = createMockToolCall('unknown_function', {});
      const result = await github.invoke(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown function');
    });

    test('should handle missing required parameters', async () => {
      const toolCall = createMockToolCall('github_create_repo', {}); // Missing repoName
      const result = await github.invoke(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('repoName');
    });

    test('should use default values for optional parameters', async () => {
      github.pushToRepo = jest.fn().mockResolvedValue({ success: true });

      const toolCall = createMockToolCall('github_push_to_repo', { 
        repoUrl: 'https://github.com/user/repo.git'
        // No branch or force specified
      });
      await github.invoke(toolCall);

      expect(github.pushToRepo).toHaveBeenCalledWith(
        'https://github.com/user/repo.git', 
        'main',  // default branch
        false    // default force
      );
    });
  });

  describe('parameter validation', () => {
    test('should validate required parameters', () => {
      expect(() => github.validateRequiredParameters({ repoName: 'test' }, ['repoName']))
        .not.toThrow();
      expect(() => github.validateRequiredParameters({}, ['repoName']))
        .toThrow();
    });
  });

  describe('error handling', () => {
    test('should handle credential errors gracefully', async () => {
      mockFs.promises.readFile.mockRejectedValue(new Error('Permission denied'));
      delete process.env.GITHUB_PAT;

      const toolCall = createMockToolCall('github_create_repo', { repoName: 'test' });
      const result = await github.invoke(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('GitHub PAT not found');
    });

    test('should handle network errors', async () => {
      mockFs.promises.readFile.mockResolvedValue('GITHUB_PAT=test-token');

      const mockRequest = {
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('Network error')), 0);
          }
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpsRequest.mockReturnValue(mockRequest);

      await expect(github.createRepo('test-repo')).rejects.toThrow('Network error');
    });
  });
});