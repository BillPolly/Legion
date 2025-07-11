/**
 * Unit tests for GitHub Tool
 */

import { jest } from '@jest/globals';
import GitHub from '../../src/github/index.js';
import { createMockToolCall, validateToolResult } from '../utils/test-helpers.js';

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
      expect(github.pushToRepo).toHaveBeenCalledWith('https://github.com/user/repo.git', 'dev', true);
    });

    test('should route github_create_and_push calls correctly', async () => {
      github.createAndPush = jest.fn().mockResolvedValue({
        success: true,
        repository: { name: 'new-repo' }
      });

      const toolCall = createMockToolCall('github_create_and_push', { 
        repoName: 'new-repo',
        description: 'New repository',
        private: false,
        branch: 'develop'
      });
      const result = await github.invoke(toolCall);

      expect(result.success).toBe(true);
      expect(github.createAndPush).toHaveBeenCalledWith('new-repo', 'New repository', false, 'develop');
    });

    test('should handle unknown function names', async () => {
      const toolCall = createMockToolCall('github_unknown_function', { 
        repoName: 'test'
      });
      const result = await github.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown function');
    });

    test('should handle missing required parameters', async () => {
      const toolCall = createMockToolCall('github_create_repo', {}); // Missing repoName
      const result = await github.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameters');
    });

    test('should use default values for optional parameters', async () => {
      github.pushToRepo = jest.fn().mockResolvedValue({ success: true });

      const toolCall = createMockToolCall('github_push_to_repo', { 
        repoUrl: 'https://github.com/user/repo.git'
        // No branch or force specified
      });
      const result = await github.invoke(toolCall);

      expect(result.success).toBe(true);
      expect(github.pushToRepo).toHaveBeenCalledWith('https://github.com/user/repo.git', 'main', false);
    });
  });
});