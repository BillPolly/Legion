/**
 * Integration tests for GitHub Tool with live API calls
 */

import { jest } from '@jest/globals';
import GitHub from '../../src/github/index.js';
import { createMockToolCall, validateToolResult, skipIfMissingEnv } from '../utils/test-helpers.js';
import { canRunIntegrationTests } from '../utils/env-setup.js';

describe('GitHub Live Integration Tests', () => {
  let github;

  beforeAll(() => {
    if (skipIfMissingEnv(['GITHUB_PAT'])) {
      return;
    }
  });

  beforeEach(() => {
    if (!canRunIntegrationTests()) {
      return;
    }
    github = new GitHub();
  });

  describe('authentication and user info', () => {\n    test('should authenticate and get user info', async () => {\n      if (skipIfMissingEnv(['GITHUB_PAT'])) return;\n\n      const credentials = await github.getCredentials();\n      expect(credentials.token).toBeTruthy();\n\n      const username = await github.getGitHubUsername(credentials.token);\n      expect(typeof username).toBe('string');\n      expect(username.length).toBeGreaterThan(0);\n    }, 15000);\n\n    test('should fail with invalid token', async () => {\n      await expect(github.getGitHubUsername('invalid-token-12345'))\n        .rejects.toThrow('Failed to get user info');\n    }, 15000);\n  });\n\n  describe('repository operations', () => {\n    const testRepoName = `jsenvoy-test-${Date.now()}`;\n    let createdRepoUrl = null;\n\n    afterEach(async () => {\n      // Cleanup: Delete test repository if it was created\n      if (createdRepoUrl && !skipIfMissingEnv(['GITHUB_PAT'])) {\n        try {\n          // Note: We would need to implement repo deletion or manually clean up\n          console.log(`Test repo created: ${createdRepoUrl} - Please delete manually if needed`);\n        } catch (error) {\n          console.warn('Could not clean up test repository:', error.message);\n        }\n      }\n    });\n\n    test('should create a new repository', async () => {\n      if (skipIfMissingEnv(['GITHUB_PAT'])) return;\n\n      const toolCall = createMockToolCall('github_create_repo', {\n        repoName: testRepoName,\n        description: 'Test repository created by jsEnvoy integration tests',\n        private: true,\n        autoInit: false\n      });\n\n      const result = await github.invoke(toolCall);\n\n      validateToolResult(result);\n      expect(result.success).toBe(true);\n      expect(result.data.name).toBe(testRepoName);\n      expect(result.data.private).toBe(true);\n      expect(result.data.url).toContain('github.com');\n      expect(result.data.cloneUrl).toContain('.git');\n      \n      createdRepoUrl = result.data.url;\n    }, 30000);\n\n    test('should handle repository creation conflict', async () => {\n      if (skipIfMissingEnv(['GITHUB_PAT'])) return;\n\n      // First, create a repo\n      const repoName = `jsenvoy-conflict-${Date.now()}`;\n      const toolCall1 = createMockToolCall('github_create_repo', {\n        repoName: repoName,\n        description: 'First repo'\n      });\n\n      const result1 = await github.invoke(toolCall1);\n      expect(result1.success).toBe(true);\n      createdRepoUrl = result1.data.url;\n\n      // Try to create the same repo again\n      const toolCall2 = createMockToolCall('github_create_repo', {\n        repoName: repoName,\n        description: 'Duplicate repo'\n      });\n\n      const result2 = await github.invoke(toolCall2);\n      validateToolResult(result2);\n      expect(result2.success).toBe(false);\n      expect(result2.error).toContain('already exists');\n    }, 45000);\n  });\n\n  describe('error handling', () => {\n    test('should handle invalid repository name', async () => {\n      if (skipIfMissingEnv(['GITHUB_PAT'])) return;\n\n      const toolCall = createMockToolCall('github_create_repo', {\n        repoName: '', // Invalid empty name\n        description: 'Test repo'\n      });\n\n      const result = await github.invoke(toolCall);\n      validateToolResult(result);\n      expect(result.success).toBe(false);\n    }, 15000);\n\n    test('should handle network timeouts gracefully', async () => {\n      if (skipIfMissingEnv(['GITHUB_PAT'])) return;\n\n      // This test depends on network conditions and may be flaky\n      // but helps verify timeout handling\n      const toolCall = createMockToolCall('github_create_repo', {\n        repoName: `timeout-test-${Date.now()}`,\n        description: 'Testing timeout handling'\n      });\n\n      // Set a reasonable timeout expectation\n      const startTime = Date.now();\n      const result = await github.invoke(toolCall);\n      const elapsed = Date.now() - startTime;\n\n      // Should complete within reasonable time (60 seconds)\n      expect(elapsed).toBeLessThan(60000);\n      validateToolResult(result);\n    }, 65000);\n  });\n});