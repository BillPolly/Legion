/**
 * Test Resource Manager GitHub Environment Access
 * Phase 1.1.1: Resource Manager can access GitHub environment variables
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/tools-registry';

describe('Resource Manager GitHub Environment Access', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Register GitHub environment variables directly for easy access
    // (This is what the Git integration will do)
    if (resourceManager.has('env.GITHUB_PAT')) {
      resourceManager.set('GITHUB_PAT', resourceManager.env.GITHUB_PAT);
    }
    if (resourceManager.has('env.GITHUB_AGENT_ORG')) {
      resourceManager.set('GITHUB_AGENT_ORG', resourceManager.env.GITHUB_AGENT_ORG);
    }
    if (resourceManager.has('env.GITHUB_USER')) {
      resourceManager.set('GITHUB_USER', resourceManager.env.GITHUB_USER);
    }
  });

  test('should access GITHUB_PAT from environment via env prefix', async () => {
    const githubPat = resourceManager.env.GITHUB_PAT;
    
    expect(githubPat).toBeDefined();
    expect(githubPat).not.toBe('');
    expect(typeof githubPat).toBe('string');
    expect(githubPat).toMatch(/^ghp_/); // GitHub PAT format
    
    console.log('✅ env.GITHUB_PAT loaded successfully, length:', githubPat.length);
  });

  test('should access GITHUB_PAT directly after registration', async () => {
    const githubPat = resourceManager.GITHUB_PAT;
    
    expect(githubPat).toBeDefined();
    expect(githubPat).not.toBe('');
    expect(typeof githubPat).toBe('string');
    expect(githubPat).toMatch(/^ghp_/); // GitHub PAT format
    
    console.log('✅ GITHUB_PAT loaded successfully, length:', githubPat.length);
  });

  test('should access GITHUB_AGENT_ORG from environment', async () => {
    const githubOrg = resourceManager.GITHUB_AGENT_ORG;
    
    expect(githubOrg).toBeDefined();
    expect(githubOrg).toBe('AgentResults');
    expect(typeof githubOrg).toBe('string');
    
    console.log('✅ GITHUB_AGENT_ORG loaded successfully:', githubOrg);
  });

  test('should access GITHUB_USER from environment', async () => {
    const githubUser = resourceManager.GITHUB_USER;
    
    expect(githubUser).toBeDefined();
    expect(githubUser).not.toBe('');
    expect(typeof githubUser).toBe('string');
    
    console.log('✅ GITHUB_USER loaded successfully:', githubUser);
  });

  test('should handle missing environment variables gracefully', () => {
    const hasNonExistent = resourceManager.has('NON_EXISTENT_GITHUB_VAR');
    expect(hasNonExistent).toBe(false);
    
    // Should throw when trying to get non-existent resource
    expect(() => {
      resourceManager.NON_EXISTENT_GITHUB_VAR;
    }).toThrow('Resource \'NON_EXISTENT_GITHUB_VAR\' not found');
  });

  test('should provide consistent access to GitHub variables', () => {
    // Test that multiple calls return the same value
    const pat1 = resourceManager.GITHUB_PAT;
    const pat2 = resourceManager.GITHUB_PAT;
    
    expect(pat1).toBe(pat2);
    
    const org1 = resourceManager.GITHUB_AGENT_ORG;
    const org2 = resourceManager.GITHUB_AGENT_ORG;
    
    expect(org1).toBe(org2);
  });

  test('should verify all required GitHub environment variables are present', () => {
    // Test that all required variables are available
    const requiredVars = ['GITHUB_PAT', 'GITHUB_AGENT_ORG', 'GITHUB_USER'];
    
    for (const varName of requiredVars) {
      expect(resourceManager.has(varName)).toBe(true);
      const value = resourceManager.get(varName);
      expect(value).toBeDefined();
      expect(value).not.toBe('');
    }
    
    console.log('✅ All required GitHub environment variables are present');
  });
});